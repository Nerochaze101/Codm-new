import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import {
  MessageSquare, Send, Mic, MicOff, Volume2, VolumeX,
  Radio, Shield, Clock, Sparkles, Check, AlertCircle, RefreshCw, Trash2, Headphones
} from 'lucide-react';
import { sendMatchChat, clearMatchChat } from '../services/api';
import { io, Socket } from 'socket.io-client';

interface MatchLobbyChatProps {
  matchId: string;
  currentUser: UserProfile;
  opponentName?: string;
  initialMessages?: ChatMessage[];
  isSettled?: boolean;
}

const TACTICAL_SHORTCUTS = [
  "Ready to play! Let's go ⚔️",
  "Confirming rules: Snipers only 🎯",
  "Give me 2 mins to open CODM ⏱️",
  "In CODM private lobby, waiting 🎮",
  "Send in-game invite now 📲",
  "Good Game! 🏆"
];

// Helper: Convert Float32Array to 16-bit PCM Int16Array
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

// Helper: Convert Int16Array to Base64
function int16ToBase64(int16Array: Int16Array): string {
  const uint8 = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 to Float32Array
function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return float32;
}

export const MatchLobbyChat: React.FC<MatchLobbyChatProps> = ({
  matchId,
  currentUser,
  opponentName = 'Opponent',
  initialMessages = [],
  isSettled = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [chatClearedNotice, setChatClearedNotice] = useState(false);

  // Audio / Mic Voice Communication State
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [outputVolume, setOutputVolume] = useState(1.0);

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletRef = useRef<AudioWorkletNode | null>(null);
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const remoteAudioGainNodeRef = useRef<GainNode | null>(null);

  // 1. Socket.io Connection Setup
  useEffect(() => {
    const socket = io('/', {
        query: { matchId, userId: currentUser.id, userName: currentUser.codmIgn }
    });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));
    socket.on('chat', (message: ChatMessage) => setMessages((prev) => [...prev, message]));
    socket.on('mic_state', (data: any) => {
        if (data.userId !== currentUser.id) setOpponentSpeaking(Boolean(data.isSpeaking));
    });
    socket.on('audio_stream', (data: any) => {
        if (data.userId !== currentUser.id) playRemoteAudio(data.pcm, data.sampleRate);
    });

    return () => { socket.disconnect(); };
  }, [matchId]);

  // 2. Start Live Audio with AudioWorklet
  const startAudio = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioCtx;

        await audioCtx.audioWorklet.addModule('/audio-processor.js');
        const workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');
        audioWorkletRef.current = workletNode;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(workletNode);

        workletNode.port.onmessage = (e) => {
            if (socketRef.current && isMicEnabled && !isMicMuted) {
                const pcm16 = floatTo16BitPCM(e.data);
                socketRef.current.emit('audio_stream', { pcm: int16ToBase64(pcm16), sampleRate: 16000 });
            }
        };

        setIsMicEnabled(true);
    } catch (e) {
        setAudioError('Mic access denied');
    }
  };

  const playRemoteAudio = (base64Pcm: string, sampleRate: number) => {
    if (!remoteAudioCtxRef.current) {
        remoteAudioCtxRef.current = new AudioContext({ sampleRate });
        remoteAudioGainNodeRef.current = remoteAudioCtxRef.current.createGain();
        remoteAudioGainNodeRef.current.connect(remoteAudioCtxRef.current.destination);
    }

    const float32 = base64ToFloat32(base64Pcm);
    const buffer = remoteAudioCtxRef.current.createBuffer(1, float32.length, sampleRate);
    buffer.getChannelData(0).set(float32);

    const source = remoteAudioCtxRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(remoteAudioGainNodeRef.current!);
    source.start();
  };

  const stopAudio = () => {
    if (audioContextRef.current) audioContextRef.current.close();
    if (remoteAudioCtxRef.current) remoteAudioCtxRef.current.close();
    setIsMicEnabled(false);
  };

  const handleSendMessage = async () => {
    if (!socketRef.current || !inputText.trim()) return;
    socketRef.current.emit('chat', { text: inputText });
    setInputText('');
  };

  return (
    <div className="bg-neutral-900 p-4 rounded-2xl flex flex-col h-[500px]">
        {/* Simplified UI for demonstration of functionality */}
        <div className="flex-1 overflow-y-auto space-y-2">
            {messages.map((m, i) => <div key={i} className="text-white text-xs">{m.senderName}: {m.text}</div>)}
        </div>
        <div className="flex gap-2">
            <button onClick={startAudio} className="text-white">Enable Mic</button>
            <input value={inputText} onChange={(e) => setInputText(e.target.value)} className="bg-neutral-800 text-white" />
            <button onClick={handleSendMessage} className="text-white">Send</button>
        </div>
    </div>
  );
};
