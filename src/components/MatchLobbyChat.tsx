import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import { Send, Mic, MicOff, Volume2, VolumeX, Radio, Shield, Trash2, Headphones } from 'lucide-react';
import { clearMatchChat } from '../services/api';
import { io, Socket } from 'socket.io-client';

interface MatchLobbyChatProps {
  matchId: string;
  currentUser: UserProfile;
  opponentName?: string;
  initialMessages?: ChatMessage[];
  isSettled?: boolean;
}

// Helper: Convert Float32Array to 16-bit PCM Int16Array
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

function int16ToBase64(int16Array: Int16Array): string {
  const uint8 = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  for (let i = 0; i < uint8.byteLength; i++) binary += String.fromCharCode(uint8[i]);
  return btoa(binary);
}

function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) float32[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  return float32;
}

export const MatchLobbyChat: React.FC<MatchLobbyChatProps> = ({
  matchId, currentUser, opponentName = 'Opponent', initialMessages = [], isSettled = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const socket = io('/', { query: { matchId } });
    socketRef.current = socket;
    socket.on('chat', (m) => setMessages((p) => [...p, m]));
    socket.on('mic_state', (d) => { if (d.userId !== currentUser.id) setOpponentSpeaking(d.isSpeaking); });
    socket.on('audio_stream', (d) => { if (d.userId !== currentUser.id) playRemoteAudio(d.pcm, d.sampleRate); });
    return () => { socket.disconnect(); };
  }, [matchId]);

  const startAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      await audioCtx.audioWorklet.addModule('/audio-processor.js');
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(workletNode);
      workletNode.port.onmessage = (e) => {
        if (socketRef.current && isMicEnabled && !isMicMuted) {
          socketRef.current.emit('audio_stream', { pcm: int16ToBase64(floatTo16BitPCM(e.data)), sampleRate: 16000 });
        }
      };
      setIsMicEnabled(true);
    } catch (e) { alert('Mic access denied'); }
  };

  const playRemoteAudio = (pcm: string, sampleRate: number) => {
    if (!remoteAudioCtxRef.current) remoteAudioCtxRef.current = new AudioContext({ sampleRate });
    const float32 = base64ToFloat32(pcm);
    const buffer = remoteAudioCtxRef.current.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);
    const source = remoteAudioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(remoteAudioCtxRef.current.destination);
    source.start();
  };

  const stopAudio = () => {
    if (audioContextRef.current) audioContextRef.current.close();
    setIsMicEnabled(false);
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    socketRef.current?.emit('chat', { text: inputText, matchId, senderId: currentUser.id, senderName: currentUser.codmIgn, timestamp: Date.now() });
    setInputText('');
  };

  return (
    <div className="flex flex-col h-[500px] bg-neutral-900 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex justify-between items-center">
            <span className="text-white font-bold text-sm">Chat with {opponentName}</span>
            <button onClick={isMicEnabled ? stopAudio : startAudio} className={`p-2 rounded-full ${isMicEnabled ? 'bg-emerald-500' : 'bg-neutral-800'}`}>
                {isMicEnabled ? <Mic className="text-white" /> : <MicOff className="text-neutral-400" />}
            </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-neutral-800/50">
            {messages.map((m, i) => (
                <div key={i} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`p-3 rounded-2xl max-w-[80%] ${m.senderId === currentUser.id ? 'bg-emerald-600 text-white rounded-br-none' : 'bg-neutral-700 text-white rounded-bl-none'}`}>
                        <p className="text-xs">{m.text}</p>
                    </div>
                </div>
            ))}
        </div>
        
        {/* Input */}
        <div className="p-3 bg-neutral-950 flex items-center gap-2">
            <input value={inputText} onChange={(e) => setInputText(e.target.value)} className="flex-1 bg-neutral-900 rounded-full px-4 py-2 text-white text-sm" placeholder="Type a message..." />
            <button onClick={sendMessage} className="p-2 bg-emerald-600 rounded-full text-white"><Send size={18} /></button>
        </div>
    </div>
  );
};
