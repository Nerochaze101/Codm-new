import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, ChatMessage } from '../types';
import {
  MessageSquare, Send, Mic, MicOff, Volume2, VolumeX,
  Radio, Shield, Clock, Sparkles, Check, AlertCircle, RefreshCw, Trash2, Headphones
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

// Expanded STUN servers for WebRTC audio peer connection
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ],
  iceCandidatePoolSize: 10
};

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
  const [activeUsers, setActiveUsers] = useState<Array<{ userId: string; userName: string }>>([]);
  const [chatClearedNotice, setChatClearedNotice] = useState(false);

  // Audio / Mic Voice Communication State
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [myVolumeLevel, setMyVolumeLevel] = useState(0);
  const [opponentMicConnected, setOpponentMicConnected] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [opponentVolumeLevel, setOpponentVolumeLevel] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [speakerTested, setSpeakerTested] = useState(false);
  const [outputVolume, setOutputVolume] = useState(1.0);

  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const silentLoopAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackAudioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const nextPlayTimeRef = useRef<number>(0);
  const isPoliteRef = useRef<boolean>(false);
  const opponentSpeakingTimerRef = useRef<any>(null);

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

  // If match becomes settled, clear local messages and stop voice
  useEffect(() => {
    if (isSettled) {
      setMessages([]);
      setChatClearedNotice(true);
      stopAudio();
    }
  }, [isSettled]);

  // Ensure AudioContext is kept awake when tab goes to background or user switches apps
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' || document.visibilityState === 'hidden') {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume().catch(() => {});
        }
        if (playbackAudioCtxRef.current && playbackAudioCtxRef.current.state === 'suspended') {
          playbackAudioCtxRef.current.resume().catch(() => {});
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  // Helper to ensure playback AudioContext is created and running
  const getPlaybackAudioContext = () => {
    if (!playbackAudioCtxRef.current || playbackAudioCtxRef.current.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      playbackAudioCtxRef.current = new AudioCtxClass();
    }
    if (playbackAudioCtxRef.current.state === 'suspended') {
      playbackAudioCtxRef.current.resume().catch(() => {});
    }
    return playbackAudioCtxRef.current;
  };

  // 1. WebSocket Connection Setup
  useEffect(() => {
    let isMounted = true;
    let reconnectTimeout: any = null;

    const connectWs = () => {
      try {
        if (typeof window === 'undefined' || typeof WebSocket === 'undefined') return;
        const host = window.location.host;
        if (!host || host.trim() === '') return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const safeMatchId = encodeURIComponent(matchId || '');
        const safeUserId = encodeURIComponent(currentUser?.id || 'guest');
        const safeUserName = encodeURIComponent(currentUser?.codmIgn || 'Gamer');
        const wsUrl = `${protocol}//${host}/ws?matchId=${safeMatchId}&userId=${safeUserId}&userName=${safeUserName}`;

        let ws: WebSocket;
        try {
          ws = new WebSocket(wsUrl);
        } catch (wsErr) {
          console.warn('WebSocket init warning:', wsErr);
          return;
        }

        wsRef.current = ws;

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
        };

        ws.onmessage = async (event) => {
          if (!isMounted) return;
          try {
            if (!event.data) return;
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
                // Determine polite peer role based on userId comparison for perfect WebRTC negotiation
                const other = data.activeUsers.find((u: any) => u.userId !== currentUser.id);
                if (other) {
                  isPoliteRef.current = currentUser.id < other.userId;
                }
              }
            } else if (data.type === 'signal') {
              handleWebRtcSignal(data.signal);
            } else if (data.type === 'mic_state') {
              if (data.userId !== currentUser.id) {
                setOpponentMicConnected(!data.isMuted);
                setOpponentSpeaking(Boolean(data.isSpeaking));
              }
            } else if (data.type === 'audio_stream') {
              // Direct real-time audio chunk from opponent (NAT-penetrating fallback & parallel engine)
              if (data.userId !== currentUser.id && data.pcm) {
                handleIncomingAudioChunk(data.pcm, data.sampleRate || 16000);
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
        try {
          wsRef.current.close();
        } catch (_) {}
      }
      stopAudio();
    };
  }, [matchId, currentUser.id, isSettled]);

  // 2. Play incoming audio chunks via Web Audio API with zero latency
  const handleIncomingAudioChunk = (base64Pcm: string, sampleRate: number) => {
    try {
      const audioCtx = getPlaybackAudioContext();
      const float32Samples = base64ToFloat32(base64Pcm);
      if (float32Samples.length === 0) return;

      // Calculate opponent volume level for visual meter
      let sum = 0;
      for (let i = 0; i < float32Samples.length; i++) {
        sum += Math.abs(float32Samples[i]);
      }
      const avg = sum / float32Samples.length;
      const volumeLevel = Math.min(100, Math.round(avg * 400));
      setOpponentVolumeLevel(volumeLevel);
      setOpponentMicConnected(true);

      if (volumeLevel > 5) {
        setOpponentSpeaking(true);
        if (opponentSpeakingTimerRef.current) clearTimeout(opponentSpeakingTimerRef.current);
        opponentSpeakingTimerRef.current = setTimeout(() => {
          setOpponentSpeaking(false);
          setOpponentVolumeLevel(0);
        }, 350);
      }

      // Create audio buffer and schedule playback
      const audioBuffer = audioCtx.createBuffer(1, float32Samples.length, sampleRate);
      audioBuffer.getChannelData(0).set(float32Samples);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      // Gain node for user volume slider control
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = outputVolume;

      source.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      const startTime = Math.max(now, nextPlayTimeRef.current);
      source.start(startTime);
      nextPlayTimeRef.current = startTime + audioBuffer.duration;
    } catch (chunkErr) {
      console.warn('Error playing live audio chunk:', chunkErr);
    }
  };

  // 3. WebRTC Peer Connection & ICE Handling
  const initPeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          try {
            wsRef.current.send(JSON.stringify({
              type: 'signal',
              signal: { candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate }
            }));
          } catch (_) {}
        }
      };

      pc.ontrack = (event) => {
        setOpponentMicConnected(true);
        const stream = event.streams[0] || new MediaStream([event.track]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = outputVolume;
          remoteAudioRef.current.play().catch((playErr) => {
            console.warn('Remote audio autoplay waiting for gesture:', playErr);
          });
        }
      };

      // Add local tracks if stream already active
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, localStreamRef.current!);
          } catch (_) {}
        });
      }

      return pc;
    } catch (e) {
      console.warn('RTCPeerConnection init notice:', e);
      return null;
    }
  };

  const drainPendingIceCandidates = async (pc: RTCPeerConnection) => {
    while (pendingCandidatesRef.current.length > 0) {
      const candidate = pendingCandidatesRef.current.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.warn('Error adding queued ICE candidate:', e);
        }
      }
    }
  };

  const handleWebRtcSignal = async (signal: any) => {
    try {
      if (!signal) return;
      const pc = initPeerConnection();
      if (!pc) return;

      if (signal.sdp) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await drainPendingIceCandidates(pc);

          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            if (wsRef.current?.readyState === WebSocket.OPEN && pc.localDescription) {
              wsRef.current.send(JSON.stringify({
                type: 'signal',
                signal: { sdp: pc.localDescription }
              }));
            }
          }
        } catch (sdpErr) {
          console.warn('WebRTC SDP negotiation notice:', sdpErr);
        }
      } else if (signal.candidate) {
        try {
          const iceCandidate = new RTCIceCandidate(signal.candidate);
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(iceCandidate);
          } else {
            pendingCandidatesRef.current.push(signal.candidate);
          }
        } catch (candidateErr) {
          console.warn('WebRTC ICE notice:', candidateErr);
        }
      }
    } catch (err) {
      console.warn('WebRTC signal handling notice:', err);
    }
  };

  // 4. Start Live Audio & Mobile Background Session
  const startAudio = async () => {
    try {
      setAudioError(null);

      // A. Unlock browser audio playback context with user gesture
      const playbackCtx = getPlaybackAudioContext();
      if (playbackCtx.state === 'suspended') {
        await playbackCtx.resume();
      }

      // B. Start silent loop audio track to keep mobile OS background audio alive
      try {
        if (silentLoopAudioRef.current) {
          silentLoopAudioRef.current.volume = 0.01;
          await silentLoopAudioRef.current.play().catch(() => {});
        }
      } catch (_) {}

      // C. Register MediaSession for mobile lockscreen/background persistence
      if ('mediaSession' in navigator && (window as any).MediaMetadata) {
        try {
          navigator.mediaSession.metadata = new (window as any).MediaMetadata({
            title: `CODM Battle Comms - Room #${matchId.slice(-4).toUpperCase()}`,
            artist: `Speaking with ${opponentName}`,
            album: 'SafeEscrow Realtime Arena',
          });
          navigator.mediaSession.playbackState = 'playing';
        } catch (_) {}
      }

      // D. Acquire microphone audio stream
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

      // E. Setup AudioContext capture & Real-time Live Audio Streaming Engine
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        const captureCtx = new AudioCtxClass();
        audioContextRef.current = captureCtx;

        const source = captureCtx.createMediaStreamSource(stream);
        const analyser = captureCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Visual waveform checking
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

          const isSpeakingNow = level > 12;
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

        // Real-Time Audio Chunk Streaming over WebSocket (NAT-Penetrating)
        // Uses ScriptProcessorNode with bufferSize = 2048 to stream audio chunks
        const scriptProcessor = captureCtx.createScriptProcessor(2048, 1, 1);
        source.connect(scriptProcessor);
        scriptProcessor.connect(captureCtx.destination);

        scriptProcessor.onaudioprocess = (e) => {
          if (localStreamRef.current && !isMicMuted) {
            const inputChannel = e.inputBuffer.getChannelData(0);
            const pcm16 = floatTo16BitPCM(inputChannel);
            const base64Pcm = int16ToBase64(pcm16);

            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({
                type: 'audio_stream',
                pcm: base64Pcm,
                sampleRate: captureCtx.sampleRate || 16000
              }));
            }
          }
        };
      } catch (audioCtxErr) {
        console.warn('Web Audio capture API note:', audioCtxErr);
      }

      // F. Setup WebRTC PeerConnection Offer
      try {
        const pc = initPeerConnection();
        if (pc) {
          stream.getTracks().forEach((track) => {
            try {
              pc.addTrack(track, stream);
            } catch (_) {}
          });

          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          if (wsRef.current?.readyState === WebSocket.OPEN && pc.localDescription) {
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
        }
      } catch (peerErr) {
        console.warn('WebRTC peer negotiation warning:', peerErr);
      }
    } catch (err: any) {
      console.error('Microphone access notice:', err);
      const msg = String(err?.message || '');
      if (msg.includes('pattern') || msg.includes('SyntaxError') || msg.includes('DOMException')) {
        setAudioError('Microphone permission or secure audio context is needed. Text chat is active!');
      } else if (msg.includes('NotAllowedError') || msg.includes('Permission') || msg.includes('denied')) {
        setAudioError('Microphone permission was denied. Please allow microphone access in your browser settings.');
      } else {
        setAudioError(err?.message || 'Microphone access failed. Please check browser settings.');
      }
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
    if (silentLoopAudioRef.current) {
      try {
        silentLoopAudioRef.current.pause();
      } catch (_) {}
    }
    setIsMicEnabled(false);
    setIsMicMuted(false);
    setMyVolumeLevel(0);
    setOpponentSpeaking(false);
    setOpponentVolumeLevel(0);
  };

  // Test Speaker / Output Unmute helper
  const handleTestSpeaker = () => {
    try {
      const audioCtx = getPlaybackAudioContext();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      // Play short clean double-beep chime
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0, audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.25 * outputVolume, audioCtx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);

      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = false;
        remoteAudioRef.current.volume = outputVolume;
        remoteAudioRef.current.play().catch(() => {});
      }

      setSpeakerTested(true);
      setTimeout(() => setSpeakerTested(false), 3000);
    } catch (e) {
      console.warn('Speaker test error:', e);
    }
  };

  // 5. Send Text Message
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
    <div className="relative overflow-hidden rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl flex flex-col h-[520px]">
      {/* Invisible but active audio elements positioned off-screen to avoid mobile autoplay throttle */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
      />
      {/* Silent 1-second WAV audio loop for mobile background execution */}
      <audio
        ref={silentLoopAudioRef}
        loop
        playsInline
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        style={{ position: 'fixed', top: -9999, left: -9999, width: 1, height: 1, opacity: 0.01, pointerEvents: 'none' }}
      />

      {/* 1. Header Bar with Presence & Voice Controls */}
      <div className="p-3 bg-neutral-950 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
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

        {/* Live Audio / Mic Bar & Speaker Tools */}
        <div className="flex items-center flex-wrap gap-1.5">
          {/* Test Speaker Button */}
          <button
            type="button"
            onClick={handleTestSpeaker}
            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 border ${
              speakerTested
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 ring-1 ring-emerald-400/50'
                : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border-neutral-700'
            }`}
            title="Click to test your speaker output or unlock browser audio"
          >
            <Headphones className="w-3 h-3 text-amber-400" />
            <span>{speakerTested ? 'Speaker Sounding Good! 🔊' : 'Test Audio'}</span>
          </button>

          {!isMicEnabled ? (
            <button
              type="button"
              onClick={startAudio}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-md uppercase tracking-wider"
              title="Start real-time voice communication with opponent"
            >
              <Mic className="w-3.5 h-3.5 text-neutral-950" />
              <span>Enable Voice Mic</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 p-1 rounded-xl bg-neutral-900 border border-neutral-700">
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
                <div className="flex items-end gap-0.5 px-1.5 h-4" title={`Your mic volume: ${myVolumeLevel}%`}>
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

      {/* Opponent Live Voice Status Ribbon */}
      <div className="px-3.5 py-1.5 bg-neutral-950/90 border-b border-neutral-800 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Volume2 className={`w-3.5 h-3.5 ${opponentSpeaking ? 'text-emerald-400 animate-bounce' : 'text-neutral-500'}`} />
            <span className="text-neutral-400">{opponentName}'s Voice:</span>
            {opponentSpeaking ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <span>Speaking Live</span>
                <span className="flex items-end gap-0.5 h-3">
                  {[0.5, 1.0, 0.7, 0.3].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-emerald-400 rounded-full animate-pulse"
                      style={{ height: `${Math.max(4, Math.round((opponentVolumeLevel / 100) * 12 * h))}px` }}
                    />
                  ))}
                </span>
              </span>
            ) : opponentMicConnected ? (
              <span className="text-neutral-300 font-medium">Mic Active (Listening)</span>
            ) : (
              <span className="text-neutral-500">Connecting / Standby</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-neutral-400">
          <span className="text-[10px] uppercase font-mono">Vol:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={outputVolume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setOutputVolume(val);
              if (remoteAudioRef.current) remoteAudioRef.current.volume = val;
            }}
            className="w-16 h-1.5 accent-amber-400 cursor-pointer bg-neutral-800 rounded-lg"
            title={`Voice Volume: ${Math.round(outputVolume * 100)}%`}
          />
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
              Coordinate in-game room invite, rules, and match start time with {opponentName}. Live voice and chat work continuously even if you switch apps to Call of Duty: Mobile.
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
