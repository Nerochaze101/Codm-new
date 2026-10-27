import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, ChatMessage } from '../types';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Shield, Trash2,
  Check, CheckCheck, Radio, Sparkles, RefreshCw, AlertCircle, Headphones, Loader2, Wifi, WifiOff
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface MatchLobbyChatProps {
  matchId: string;
  currentUser: UserProfile;
  opponentName?: string;
  initialMessages?: ChatMessage[];
  isSettled?: boolean;
}

const SAMPLE_RATE = 16000;
const BUFFER_SIZE = 4096;

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  
  const [isMicActive, setIsMicActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [opponentPresence, setOpponentPresence] = useState<boolean>(false);
  const [isOpponentTyping, setIsOpponentTyping] = useState<boolean>(false);
  const [isTtsEnabled, setIsTtsEnabled] = useState<boolean>(true);

  const socketRef = useRef<Socket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isSpeakingRef = useRef<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ttsQueueRef = useRef<string[]>([]);

  const speakMessage = useCallback((text: string, senderName: string) => {
    if (!isTtsEnabled) return;
    
    try {
      const utterance = new SpeechSynthesisUtterance(`${senderName} says: ${text}`);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      
      // Attempt to use a more "tactical" or professional voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice = voices.find(v => v.name.includes('Google UK English Male') || v.name.includes('Daniel'));
      if (preferredVoice) utterance.voice = preferredVoice;

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('Speech synthesis failed:', err);
    }
  }, [isTtsEnabled]);

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

  const initAudioCtx = async () => {
    try {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
        return audioCtxRef.current;
      }
      
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx({ sampleRate: 44100 });
      audioCtxRef.current = ctx;

      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      gainRef.current = masterGain;

      // Mobile Safari "Unlock": Play a tiny silent buffer
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      if (ctx.state === 'suspended') await ctx.resume();
      return ctx;
    } catch (err) {
      console.error('FAILED_TO_INIT_AUDIO_CTX:', err);
      throw err;
    }
  };

  const startVoice = async () => {
    if (isInitializing) return;
    setIsInitializing(true);
    setAudioError(null);

    try {
      // 1. First, ensure AudioContext is ready (User Gesture Context)
      const ctx = await initAudioCtx();
      
      // 2. Request Hardware
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }
      
      // Request with specific constraints for better mobile compatibility
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1
        } 
      });
      streamRef.current = stream;

      // 3. Re-verify Context (sometimes iOS suspends it immediately after getUserMedia)
      if (ctx.state === 'suspended') await ctx.resume();

      // 4. Setup Processor
      const source = ctx.createMediaStreamSource(stream);
      
      // Using ScriptProcessor for maximum compatibility with older Safari
      const processor = ctx.createScriptProcessor(BUFFER_SIZE, 1, 1);
      
      processor.onaudioprocess = (e: any) => {
        const input = e.inputBuffer.getChannelData(0);
        
        // VAD (Voice Activity Detection)
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);
        setMicLevel(Math.min(100, Math.round(rms * 500)));

        const speaking = rms > 0.01;
        if (speaking !== isSpeakingRef.current) {
          isSpeakingRef.current = speaking;
          socketRef.current?.emit('mic_state', { matchId, userId: currentUser.id, isSpeaking: speaking, isMuted: false });
        }

        if (!isMuted) {
          const down = downsample(input, ctx.sampleRate, SAMPLE_RATE);
          const p16 = float32ToPcm16(down);
          const b64 = pcm16ToBase64(p16);
          socketRef.current?.emit('audio_stream', { matchId, userId: currentUser.id, pcm: b64, sampleRate: SAMPLE_RATE });
        }
      };

      source.connect(processor);
      
      // This is the "magic" for iOS: the processor must be connected to destination
      // but we use a gain of 0 to avoid feedback loops.
      const silence = ctx.createGain();
      silence.gain.value = 0;
      processor.connect(silence);
      silence.connect(ctx.destination);

      processorRef.current = processor;
      setIsMicActive(true);
      
    } catch (err: any) {
      console.error('MIC_ACTIVATION_FAILED:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setAudioError('Mic Permission Denied. Please check browser settings.');
      } else if (err.name === 'NotFoundError') {
        setAudioError('No microphone found on this device.');
      } else {
        setAudioError(`Mic Error: ${err.message || 'Unknown'}`);
      }
      setIsMicActive(false);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    } finally {
      setIsInitializing(false);
    }
  };

  const stopVoice = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    setIsMicActive(false);
    setMicLevel(0);
    isSpeakingRef.current = false;
    socketRef.current?.emit('mic_state', { matchId, userId: currentUser.id, isSpeaking: false, isMuted: true });
  };

  useEffect(() => {
    console.log(`[Chat] Initializing socket for match ${matchId}`);
    const socket = io('/', { 
      query: { matchId, userId: currentUser.id },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('joinMatch', { matchId, userId: currentUser.id });
    });

    socket.on('disconnect', () => setIsConnected(false));

    socket.on('presence', (data) => {
      if (data.matchId === matchId) {
        // If there's at least one user other than me, opponent is "present"
        const others = data.users.filter((uid: string) => uid !== currentUser.id);
        const isPresent = others.length > 0;
        
        setOpponentPresence(prev => {
          if (!prev && isPresent) {
            // Opponent just entered! Play tactical sound if not me
            try {
              const audio = new Audio('/assets/audio/shotgun.mp3');
              audio.volume = 0.4;
              audio.play().catch(() => {});
            } catch (e) {}
          }
          return isPresent;
        });
      }
    });

    socket.on('chat', (msg: ChatMessage) => {
      setIsOpponentTyping(false); // Stop typing indicator on message arrival
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        
        // Speak message if it's from opponent
        if (msg.senderId !== currentUser.id) {
          speakMessage(msg.text, msg.senderName || opponentName);
        }
        
        return [...prev, msg];
      });
    });

    socket.on('audio_stream', async (data) => {
      if (data.userId === currentUser.id) return;
      try {
        const ctx = await initAudioCtx();
        const float32 = base64ToFloat32(data.pcm);
        const buffer = ctx.createBuffer(1, float32.length, data.sampleRate || SAMPLE_RATE);
        buffer.getChannelData(0).set(float32);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(gainRef.current || ctx.destination);

        const now = ctx.currentTime;
        if (nextPlayTimeRef.current < now) nextPlayTimeRef.current = now + 0.05;
        source.start(nextPlayTimeRef.current);
        nextPlayTimeRef.current += buffer.duration;
        setOpponentSpeaking(true);
      } catch (err) {
        console.warn('Audio playback error:', err);
      }
    });

    socket.on('mic_state', (data) => {
      if (data.userId !== currentUser.id) setOpponentSpeaking(data.isSpeaking);
    });

    socket.on('typing', (data) => {
      if (data.userId !== currentUser.id) {
        setIsOpponentTyping(data.isTyping);
        
        // Auto-clear after 4s if no stop event
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => setIsOpponentTyping(false), 4000);
        }
      }
    });

    return () => {
      socket.disconnect();
      stopVoice();
      if (audioCtxRef.current) audioCtxRef.current.close();
    };
  }, [matchId, currentUser.id]);

  useEffect(() => {
    if (opponentSpeaking) {
      const t = setTimeout(() => setOpponentSpeaking(false), 1000);
      return () => clearTimeout(t);
    }
  }, [opponentSpeaking]);

  const handleSend = () => {
    if (!inputText.trim() || isSending) return;
    setIsSending(true);
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      senderId: currentUser.id,
      senderName: currentUser.codmIgn || 'You',
      text: inputText.trim(),
      timestamp: Date.now(),
    };
    socketRef.current?.emit('chat', { ...newMsg, matchId });
    setMessages(prev => [...prev, newMsg]);
    setInputText('');
    setTimeout(() => setIsSending(false), 200);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    
    // Emit typing start
    socketRef.current?.emit('typing', { matchId, userId: currentUser.id, isTyping: true });
    
    // Reset timeout to emit typing stop
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    myTypingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('typing', { matchId, userId: currentUser.id, isTyping: false });
    }, 2000);
  };

  return (
    <div className="flex flex-col h-[520px] bg-[#0c1317] rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden font-sans select-none">
      {/* Header */}
      <div className="px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-emerald-500/30">
              {opponentName.charAt(0).toUpperCase()}
            </div>
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1f2c34] ${isConnected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">{opponentName}</span>
              {opponentPresence ? (
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-neutral-600 rounded-full" />
                  Offline
                </span>
              )}
              {opponentSpeaking && (
                <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1">
                  <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" />
                  Speaking
                </span>
              )}
            </div>
            <div className="text-[10px] flex items-center gap-1.5">
              {isConnected ? (
                <div className="flex items-center gap-1 text-emerald-500/70">
                  <Wifi size={10} />
                  <span>Encrypted</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-rose-500">
                  <WifiOff size={10} />
                  <span>Connecting...</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsTtsEnabled(!isTtsEnabled)}
            className={`p-2 rounded-full transition-all ${isTtsEnabled ? 'bg-amber-500/20 text-amber-400' : 'bg-neutral-800 text-neutral-500'}`}
            title={isTtsEnabled ? 'Disable Text-to-Speech' : 'Enable Text-to-Speech'}
          >
            {isTtsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
          {isMicActive && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-full transition-all ${isMuted ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'}`}
            >
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}
          <button
            onClick={isMicActive ? stopVoice : startVoice}
            disabled={isSettled || isInitializing}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 uppercase tracking-wide ${isMicActive ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white animate-pulse'}`}
          >
            {isInitializing ? (
              <><Loader2 size={14} className="animate-spin" /><span>Syncing...</span></>
            ) : isMicActive ? (
              <><VolumeX size={14} /><span>Exit</span></>
            ) : (
              <><Mic size={14} /><span>Voice Chat</span></>
            )}
          </button>
        </div>
      </div>

      {/* Status Bar */}
      {isMicActive && (
        <div className="bg-[#111b21] px-4 py-1.5 border-b border-emerald-900/20 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-2.5">
            <Radio size={11} className="text-emerald-400 animate-pulse" />
            <span className="text-emerald-400/80 font-bold uppercase tracking-widest">Broadcasting</span>
            <div className="w-16 h-1 bg-black/40 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-400 transition-all duration-75" style={{ width: `${micLevel}%` }} />
            </div>
          </div>
          <div className="text-[#8696a0] font-mono text-[9px]">16KHz OPUS-SIM</div>
        </div>
      )}

      {audioError && (
        <div className="bg-rose-950/90 px-4 py-2 border-b border-rose-800/40 flex items-center gap-2 text-[10px] text-rose-200">
          <AlertCircle size={14} className="text-rose-400 shrink-0" />
          <span>{audioError} (Tap address bar lock icon to allow mic)</span>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#0b141a]">
        {messages.map((m, idx) => {
          const isMe = m.senderId === currentUser.id;
          return (
            <div key={m.id || idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-2.5 rounded-2xl shadow-sm max-w-[85%] relative ${isMe ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-white/5'}`}>
                {!isMe && <p className="text-[10px] font-bold text-amber-500 mb-0.5 uppercase tracking-tighter">{m.senderName || opponentName}</p>}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>
                <div className="flex justify-end mt-1 gap-1 text-[9px] text-[#8696a0]">
                  <span>{formatTime(m.timestamp)}</span>
                  {isMe && <CheckCheck size={11} className="text-emerald-400" />}
                </div>
              </div>
            </div>
          );
        })}

        {isOpponentTyping && (
          <div className="flex justify-start animate-in slide-in-from-left-2 duration-300">
            <div className="bg-[#202c33] px-3 py-2 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-1.5 shadow-md">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
              </div>
              <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-widest italic">{opponentName} is typing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 bg-[#1f2c34] border-t border-[#2a3942] flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={isSettled}
          placeholder="Type message..."
          className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isSending || isSettled}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-full transition-all active:scale-95"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};
