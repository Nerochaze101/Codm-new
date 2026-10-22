import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, ChatMessage } from '../types';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Shield, Trash2,
  Check, CheckCheck, Radio, Sparkles, RefreshCw, AlertCircle, Headphones, Info
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface MatchLobbyChatProps {
  matchId: string;
  currentUser: UserProfile;
  opponentName?: string;
  initialMessages?: ChatMessage[];
  isSettled?: boolean;
}

/**
 * VOICE CHAT ENGINE V3 - ULTIMATE MOBILE REWRITE
 * Focused on iOS Safari hardware activation and reliable low-latency streaming.
 */

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 2048; // Smaller buffer for lower latency

// --- UTILITIES ---

function float32ToPcm16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

function pcm16ToBase64(int16: Int16Array): string {
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return float32;
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    result[i] = buffer[Math.round(i * ratio)];
  }
  return result;
}

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MatchLobbyChat: React.FC<MatchLobbyChatProps> = ({
  matchId,
  currentUser,
  opponentName = 'Opponent',
  initialMessages = [],
  isSettled = false,
}) => {
  // --- UI STATE ---
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  // --- VOICE STATE ---
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  // --- REFS ---
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (initialMessages?.length) {
      setMessages(prev => {
        const ids = new Set(prev.map(m => m.id));
        const filtered = initialMessages.filter(m => !ids.has(m.id));
        return [...prev, ...filtered].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      });
    }
  }, [initialMessages]);

  // --- VOICE ENGINE INITIALIZATION ---

  const createAudioContext = () => {
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      return audioContextRef.current;
    }
    const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContextClass({ latencyHint: 'interactive' });
    audioContextRef.current = ctx;

    // Master gain for opponent voice
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gainNodeRef.current = gain;

    // iOS "Keep-Alive" sub-audible oscillator
    // Prevents iOS from killing the audio session when silent
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.value = 15;
    oscGain.gain.value = 0.00001;
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();

    return ctx;
  };

  const handleStartMic = async () => {
    setAudioError(null);
    
    // CRITICAL: iOS Safari requires getUserMedia to be the ABSOLUTE FIRST async action.
    // We do NOT await anything before this if possible.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100 // Request standard, downsample manually for stability
        }
      });
      
      streamRef.current = stream;
      const ctx = createAudioContext();
      
      // Resume context (essential for iOS)
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      
      processor.onaudioprocess = (e: any) => {
        const input = e.inputBuffer.getChannelData(0);
        
        // VU Meter calculation
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        setMicLevel(Math.min(100, Math.round(rms * 400)));

        // Speech detection
        const isSpeaking = rms > 0.01;
        
        // Send audio chunks if not muted
        if (!isMuted) {
          const resampled = downsample(input, ctx.sampleRate, SAMPLE_RATE);
          const pcm16 = float32ToPcm16(resampled);
          const base64 = pcm16ToBase64(pcm16);
          
          socketRef.current?.emit('audio_stream', {
            matchId,
            userId: currentUser.id,
            pcm: base64,
            sampleRate: SAMPLE_RATE,
            isSpeaking
          });
        }
      };

      source.connect(processor);
      // Dummy gain to destination to keep processor alive
      const dummy = ctx.createGain();
      dummy.gain.value = 0;
      processor.connect(dummy);
      dummy.connect(ctx.destination);

      processorRef.current = processor;
      setIsMicEnabled(true);
      setShowPermissionGuide(false);

    } catch (err: any) {
      console.error('MIC_INIT_ERROR:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setAudioError('Microphone access blocked.');
        setShowPermissionGuide(true);
      } else {
        setAudioError(`Hardware error: ${err.message || 'Check settings'}`);
      }
      setIsMicEnabled(false);
    }
  };

  const handleStopMic = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    setIsMicEnabled(false);
    setMicLevel(0);
    socketRef.current?.emit('mic_state', { matchId, userId: currentUser.id, isSpeaking: false, isMuted: true });
  };

  // --- SOCKET SYNC ---

  useEffect(() => {
    const socket = io('/', { query: { matchId, userId: currentUser.id } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('joinMatch', { matchId });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('chat', (msg: ChatMessage) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on('audio_stream', (data) => {
      if (data.userId === currentUser.id) return;

      const ctx = createAudioContext();
      if (ctx.state === 'suspended') ctx.resume();

      const float32 = base64ToFloat32(data.pcm);
      const buffer = ctx.createBuffer(1, float32.length, data.sampleRate || SAMPLE_RATE);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gainNodeRef.current || ctx.destination);

      // Playback scheduling with jitter buffer
      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now) {
        nextPlayTimeRef.current = now + 0.05; // 50ms buffer
      }
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;
      
      setOpponentSpeaking(true);
      // Auto-clear speaking state after a short silence
    });

    socket.on('mic_state', (data) => {
      if (data.userId !== currentUser.id) {
        setOpponentSpeaking(data.isSpeaking);
      }
    });

    return () => {
      socket.disconnect();
      handleStopMic();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [matchId, currentUser.id]);

  // Clear opponent speaking flag when stream stops
  useEffect(() => {
    if (opponentSpeaking) {
      const timer = setTimeout(() => setOpponentSpeaking(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [opponentSpeaking]);

  const handleSendMessage = () => {
    const text = inputText.trim();
    if (!text || isSending) return;
    setIsSending(true);

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      senderId: currentUser.id,
      senderName: currentUser.codmIgn || 'You',
      text,
      timestamp: Date.now(),
    };

    socketRef.current?.emit('chat', { ...newMsg, matchId });
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => setIsSending(false), 300);
  };

  return (
    <div className="flex flex-col h-[520px] bg-[#0c1317] rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden font-sans select-none">
      {/* HEADER */}
      <div className="px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942] flex items-center justify-between z-20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-emerald-500/30">
              {opponentName.charAt(0).toUpperCase()}
            </div>
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1f2c34] ${isConnected ? 'bg-emerald-400' : 'bg-neutral-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wide">{opponentName}</span>
              {opponentSpeaking && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-tight">Live</span>
                </div>
              )}
            </div>
            <div className="text-[11px] text-[#8696a0] flex items-center gap-1">
              <Shield size={10} className="text-amber-400" />
              <span>Voice Escrow Protected</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isMicEnabled && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-full transition-all ${isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            onClick={isMicEnabled ? handleStopMic : handleStartMic}
            disabled={isSettled}
            className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg active:scale-95 ${isMicEnabled ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
          >
            {isMicEnabled ? <><VolumeX size={14} /><span>Exit</span></> : <><Mic size={14} /><span>Voice Chat</span></>}
          </button>
        </div>
      </div>

      {/* MIC STATUS BAR */}
      {isMicEnabled && (
        <div className="bg-[#111b21] px-4 py-1.5 border-b border-emerald-900/30 flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
              <Radio size={12} className="animate-pulse" />
              On Air
            </span>
            <div className="w-20 h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-emerald-500/10">
              <div 
                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-100" 
                style={{ width: `${micLevel}%` }} 
              />
            </div>
          </div>
          <div className="text-[#8696a0] italic">Low Latency Enabled</div>
        </div>
      )}

      {/* ERROR & GUIDE */}
      {audioError && (
        <div className="bg-rose-950/80 px-4 py-2 border-b border-rose-800/40 flex flex-col gap-1">
          <div className="flex items-center gap-2 text-xs text-rose-200">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span className="font-bold">{audioError}</span>
          </div>
          {showPermissionGuide && (
            <div className="text-[10px] text-rose-300 pl-6 leading-tight">
              1. Tap the <span className="font-bold">LOCK</span> icon in address bar.<br />
              2. Toggle <span className="font-bold text-white">Microphone ON</span>.<br />
              3. Reload page and try again.
            </div>
          )}
        </div>
      )}

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a] relative pattern-bg">
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        
        {messages.map((m, idx) => {
          const isMe = m.senderId === currentUser.id;
          return (
            <div key={m.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-2.5 rounded-2xl shadow-sm max-w-[85%] relative ${isMe ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-[#2a3942]/40'}`}>
                {!isMe && <p className="text-[10px] font-bold text-emerald-400 mb-0.5 uppercase tracking-tighter">{m.senderName || opponentName}</p>}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                <div className="flex justify-end mt-1 gap-1 text-[9px] text-[#8696a0]">
                  <span>{formatTime(m.timestamp)}</span>
                  {isMe && <CheckCheck size={11} className="text-emerald-400" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-3 bg-[#1f2c34] border-t border-[#2a3942] flex items-center gap-2 z-20">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
          disabled={isSettled}
          placeholder={isSettled ? 'Match settled' : 'Message...'}
          className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] rounded-full px-5 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all border border-neutral-700/50"
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim() || isSending || isSettled}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-full transition-all shadow-md active:scale-90"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
