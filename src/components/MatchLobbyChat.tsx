import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import {
  MessageSquare, Send, Mic, MicOff, Volume2, VolumeX,
  Radio, Shield, Clock, Sparkles, Check, AlertCircle, RefreshCw, Trash2
} from 'lucide-react';
import { sendMatchChat, clearMatchChat } from '../services/api';

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

// STUN servers for WebRTC audio peer connection
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

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
  const [activeUsers, setActiveUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [chatClearedNotice, setChatClearedNotice] = useState(false);

  // Audio / Mic Voice Communication State
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [myVolumeLevel, setMyVolumeLevel] = useState(0);
  const [opponentMicConnected, setOpponentMicConnected] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Synchronize initial messages when match prop updates
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // If match becomes settled, clear local messages
  useEffect(() => {
    if (isSettled) {
      setMessages([]);
      setChatClearedNotice(true);
      stopAudio();
    }
  }, [isSettled]);

  // 1. WebSocket Connection Setup
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const wsUrl = `${protocol}//${host}/ws?matchId=${encodeURIComponent(matchId)}&userId=${encodeURIComponent(currentUser.id)}&userName=${encodeURIComponent(currentUser.codmIgn)}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = async (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'chat') {
              setMessages((prev) => {
                if (prev.some((m) => m.id === data.message.id)) return prev;
                return [...prev, data.message];
              });
            } else if (data.type === 'chat_cleared') {
              setMessages([]);
              setChatClearedNotice(true);
            } else if (data.type === 'presence' || data.type === 'user_joined' || data.type === 'user_left') {
              if (data.activeUsers) {
                setActiveUsers(data.activeUsers);
              }
            } else if (data.type === 'signal') {
              handleWebRtcSignal(data.signal);
            } else if (data.type === 'mic_state') {
              if (data.userId !== currentUser.id) {
                setOpponentMicConnected(!data.isMuted);
                setOpponentSpeaking(Boolean(data.isSpeaking));
              }
            }
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          // Reconnect after 3 seconds if not settled
          if (!isSettled) {
            reconnectTimeout = setTimeout(connectWs, 3000);
          }
        };

        ws.onerror = (err) => {
          console.warn('WS error:', err);
        };
      } catch (err) {
        console.warn('Could not establish WebSocket:', err);
      }
    };

    connectWs();

    return () => {
      isMounted = false;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
      }
      stopAudio();
    };
  }, [matchId, currentUser.id, isSettled]);

  // 2. WebRTC Live Voice Signaling & Connection
  const initPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'signal',
          signal: { candidate: event.candidate }
        }));
      }
    };

    pc.ontrack = (event) => {
      if (remoteAudioRef.current && event.streams[0]) {
        remoteAudioRef.current.srcObject = event.streams[0];
        setOpponentMicConnected(true);
      }
    };

    // Add local tracks if stream already active
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    return pc;
  };

  const handleWebRtcSignal = async (signal: any) => {
    try {
      const pc = initPeerConnection();

      if (signal.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        if (signal.sdp.type === 'offer') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'signal',
              signal: { sdp: pc.localDescription }
            }));
          }
        }
      } else if (signal.candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch (e) {
          console.warn('Failed to add ICE candidate:', e);
        }
      }
    } catch (err) {
      console.warn('WebRTC signal handling error:', err);
    }
  };

  const startAudio = async () => {
    try {
      setAudioError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });
      localStreamRef.current = stream;
      setIsMicEnabled(true);
      setIsMicMuted(false);

      // Web Audio API for animated volume waveform
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let speakingDebounce = false;

        const checkVolume = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const level = Math.min(100, Math.round((avg / 128) * 100));
          setMyVolumeLevel(level);

          const isSpeakingNow = level > 15;
          if (isSpeakingNow !== speakingDebounce) {
            speakingDebounce = isSpeakingNow;
            if (wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'mic_state',
                isMuted: false,
                isSpeaking: isSpeakingNow
              }));
            }
          }

          animFrameRef.current = requestAnimationFrame(checkVolume);
        };
        checkVolume();
      } catch (audioCtxErr) {
        console.warn('Web Audio API not supported:', audioCtxErr);
      }

      // Add to WebRTC connection and send offer to opponent
      const pc = initPeerConnection();
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'signal',
          signal: { sdp: pc.localDescription }
        }));
        wsRef.current.send(JSON.stringify({
          type: 'mic_state',
          isMuted: false,
          isSpeaking: false
        }));
      }
    } catch (err: any) {
      console.error('Microphone access failed:', err);
      setAudioError(err.message || 'Microphone access denied. Please allow mic in browser settings.');
      setIsMicEnabled(false);
    }
  };

  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const newMuted = !isMicMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !newMuted;
    });
    setIsMicMuted(newMuted);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'mic_state',
        isMuted: newMuted,
        isSpeaking: false
      }));
    }
  };

  const stopAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setIsMicEnabled(false);
    setIsMicMuted(false);
    setMyVolumeLevel(0);
  };

  // 3. Send Text Message
  const handleSendMessage = async (textToSend?: string) => {
    const content = (textToSend || inputText).trim();
    if (!content || isSending) return;

    setIsSending(true);
    setInputText('');

    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: currentUser.id,
      senderName: currentUser.codmIgn,
      text: content,
      timestamp: Date.now(),
    };

    // Optimistic UI update
    setMessages((prev) => [...prev, newMsg]);

    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'chat',
          text: content,
        }));
      } else {
        // Fallback to REST API
        await sendMatchChat(matchId, currentUser.id, content);
      }
    } catch (err: any) {
      console.error('Error sending chat message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleManualClearChat = async () => {
    if (!confirm('Clear all chat messages from database now?')) return;
    try {
      await clearMatchChat(matchId);
      setMessages([]);
      setChatClearedNotice(true);
    } catch (err: any) {
      alert(err.message || 'Failed to clear chat');
    }
  };

  const isOpponentInRoom = activeUsers.some((u) => u.userId !== currentUser.id);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl flex flex-col h-[480px]">
      {/* Invisible audio element for opponent voice output */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* 1. Header Bar with Presence & Voice Controls */}
      <div className="p-3.5 bg-neutral-950 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold font-heading text-white tracking-wide uppercase">
                Match Lobby Comms
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isConnected ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-neutral-800 text-neutral-400'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
                {isConnected ? 'Real-Time' : 'Connecting...'}
              </span>
            </div>
            <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <span>Opponent:</span>
              <strong className="text-neutral-200">{opponentName}</strong>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isOpponentInRoom ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
              <span className="text-[10px] text-neutral-500">{isOpponentInRoom ? 'Active in lobby' : 'Waiting'}</span>
            </div>
          </div>
        </div>

        {/* Live Audio / Mic Bar */}
        <div className="flex items-center gap-2">
          {!isMicEnabled ? (
            <button
              type="button"
              onClick={startAudio}
              className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border border-neutral-700 shadow-sm"
              title="Start real-time audio communication with opponent"
            >
              <Mic className="w-3.5 h-3.5 text-amber-400" />
              <span>Enable Voice Mic</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-700">
              <button
                type="button"
                onClick={toggleMute}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isMicMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500 text-neutral-950 shadow-md font-black'
                }`}
                title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{isMicMuted ? 'Muted' : 'Mic Live'}</span>
              </button>

              {/* Animated Volume Waveform Bars */}
              {!isMicMuted && (
                <div className="flex items-end gap-0.5 px-2 h-4" title={`Volume level: ${myVolumeLevel}%`}>
                  {[0.4, 0.7, 1.0, 0.6, 0.3].map((heightMulti, idx) => {
                    const activeHeight = Math.max(3, Math.round((myVolumeLevel / 100) * 16 * heightMulti));
                    return (
                      <span
                        key={idx}
                        className="w-1 bg-emerald-400 rounded-full transition-all duration-75"
                        style={{ height: `${activeHeight}px` }}
                      />
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={stopAudio}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                title="Disconnect voice"
              >
                <VolumeX className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Opponent Voice Indicator */}
          {opponentMicConnected && (
            <div className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold flex items-center gap-1.5 border ${
              opponentSpeaking
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : 'bg-neutral-800 text-neutral-300 border-neutral-700'
            }`}>
              <Volume2 className="w-3 h-3 text-emerald-400" />
              <span>{opponentSpeaking ? 'Opponent Speaking...' : 'Opponent Mic Live'}</span>
            </div>
          )}

          {/* Manual clear chat */}
          {messages.length > 0 && !isSettled && (
            <button
              type="button"
              onClick={handleManualClearChat}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Clear lobby chat from database"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {audioError && (
        <div className="p-2.5 bg-rose-500/10 border-b border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{audioError}</span>
        </div>
      )}

      {/* 2. Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
        {chatClearedNotice && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center space-y-1">
            <div className="font-bold flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-400" />
              <span>Chat Purged for Privacy</span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Lobby chat transcript has been safely wiped from the database.
            </p>
          </div>
        )}

        {messages.length === 0 && !chatClearedNotice && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-neutral-400 space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-center text-neutral-500">
              <Radio className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Lobby Comms Channel Open
            </div>
            <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed">
              Coordinate in-game room invite, rules, and match start time with {opponentName}. Live voice and chat are automatically wiped once settled.
            </p>
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.senderId === currentUser.id;
          const isSys = msg.senderId === 'SYSTEM';

          if (isSys) {
            return (
              <div key={msg.id} className="p-2.5 rounded-xl bg-neutral-950/80 border border-amber-500/20 text-xs text-neutral-300 flex items-start gap-2">
                <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-amber-400 text-[11px] block">{msg.senderName}</span>
                  <span className="text-[11px] leading-relaxed">{msg.text}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[10px] font-bold text-neutral-400">
                  {isMe ? 'You' : msg.senderName}
                </span>
                <span className="text-[9px] text-neutral-400 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-3.5 py-2 rounded-2xl text-xs font-medium leading-relaxed shadow-md ${
                  isMe
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-neutral-950 rounded-tr-xs font-bold'
                    : 'bg-neutral-800 border border-neutral-700/80 text-white rounded-tl-xs'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={chatBottomRef} />
      </div>

      {/* 3. Tactical Shortcuts */}
      {!isSettled && (
        <div className="px-3 py-1.5 bg-neutral-950/70 border-t border-neutral-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-[9px] font-mono uppercase text-neutral-400 shrink-0 font-bold">Fast:</span>
          {TACTICAL_SHORTCUTS.map((phrase, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(phrase)}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 text-neutral-300 hover:text-white text-[10px] whitespace-nowrap transition-colors cursor-pointer shrink-0"
            >
              {phrase}
            </button>
          ))}
        </div>
      )}

      {/* 4. Chat Input & Send Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Message ${opponentName} (start time, rules, room code)...`}
          disabled={isSettled}
          className="flex-1 px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs placeholder:text-neutral-500 focus:outline-none focus:border-amber-400 transition-colors disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending || isSettled}
          className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wide transition-all shadow-md cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
        >
          <Send className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </form>
    </div>
  );
};
