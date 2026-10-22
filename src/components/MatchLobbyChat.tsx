import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, ChatMessage } from '../types';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Shield, Trash2,
  Check, CheckCheck, Radio, Sparkles, RefreshCw, AlertCircle, Headphones
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

interface MatchLobbyChatProps {
  matchId: string;
  currentUser: UserProfile;
  opponentName?: string;
  initialMessages?: ChatMessage[];
  isSettled?: boolean;
}

// Convert Float32Array to 16-bit PCM Int16Array
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return output;
}

// Convert Int16Array to base64
function int16ToBase64(int16Array: Int16Array): string {
  const uint8 = new Uint8Array(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
  let binary = '';
  for (let i = 0; i < uint8.byteLength; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// Convert base64 back to Float32Array
function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
  const float32 = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  }
  return float32;
}

// High-quality downsampler to reduce native sample rate (e.g. 48kHz/44.1kHz) to 16kHz
function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (toRate >= fromRate) return buffer;
  const ratio = fromRate / toRate;
  const newLength = Math.round(buffer.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < newLength) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

// Format timestamp into WhatsApp style: 10:45 AM
function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const MatchLobbyChat: React.FC<MatchLobbyChatProps> = ({
  matchId,
  currentUser,
  opponentName = 'Opponent',
  initialMessages = [],
  isSettled = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Initial deduplication on load
    const seen = new Set<string>();
    return initialMessages.filter((m) => {
      const key = m.id || `${m.senderId}_${m.timestamp}_${m.text}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  });

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [opponentSpeaking, setOpponentSpeaking] = useState(false);
  const [opponentVolume, setOpponentVolume] = useState(1.0);
  const [isConnected, setIsConnected] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [testToneActive, setTestToneActive] = useState(false);

  // Live mic feedback states
  const [micLevel, setMicLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoopbackEnabled, setIsLoopbackEnabled] = useState(false);
  const [isTestingMic, setIsTestingMic] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const streamDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const carrierOscRef = useRef<OscillatorNode | null>(null);
  const wakeLockRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const silentAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Persistent audio pipeline node refs to prevent browser garbage collection
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const loopbackGainRef = useRef<GainNode | null>(null);
  const lastSpeakingStateRef = useRef<boolean>(false);
  const lastLevelUpdateRef = useRef<number>(0);
  const micTestTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-scroll to latest message
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages.length, scrollToBottom]);

  // Sync initialMessages prop updates safely without introducing duplicates
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages((prev) => {
        const map = new Map<string, ChatMessage>();
        prev.forEach((m) => {
          const key = m.id || `${m.senderId}_${m.timestamp}_${m.text}`;
          map.set(key, m);
        });
        initialMessages.forEach((m) => {
          const key = m.id || `${m.senderId}_${m.timestamp}_${m.text}`;
          if (!map.has(key)) {
            map.set(key, m);
          }
        });
        return Array.from(map.values()).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      });
    }
  }, [initialMessages]);

  // Initialize playback AudioContext using native hardware sample rate
  const ensurePlaybackContext = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const gain = ctx.createGain();
      gain.gain.value = opponentVolume;
      gain.connect(ctx.destination);

      // Create MediaStream destination for HTML5 <audio> tag to keep mobile background audio active
      try {
        if (ctx.createMediaStreamDestination) {
          const dest = ctx.createMediaStreamDestination();
          gain.connect(dest);
          streamDestRef.current = dest;
          if (remoteAudioRef.current && dest.stream) {
            remoteAudioRef.current.srcObject = dest.stream;
            remoteAudioRef.current.muted = true; // Mute element to prevent double-audio output over WebAudio
            remoteAudioRef.current.play().catch(() => {});
          }
        }
      } catch (destErr) {
        console.warn('MediaStreamDestination fallback:', destErr);
      }

      // Connect sub-audible carrier (12 Hz) to keep mobile audio stack alive
      try {
        const carrierOsc = ctx.createOscillator();
        const carrierGain = ctx.createGain();
        carrierOsc.type = 'sine';
        carrierOsc.frequency.setValueAtTime(12, ctx.currentTime);
        carrierGain.gain.setValueAtTime(0.00005, ctx.currentTime);
        carrierOsc.connect(carrierGain);
        carrierGain.connect(ctx.destination);
        carrierOsc.start();
        carrierOscRef.current = carrierOsc;
      } catch (cErr) {
        console.warn('Carrier tone init:', cErr);
      }

      gainNodeRef.current = gain;
      playbackCtxRef.current = ctx;

      // MediaSession registration for background persistence
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'CODM 1v1 Voice Comms (Live)',
            artist: 'CODM Stake Arena',
            album: `1v1 Match vs ${opponentName}`,
            artwork: [
              { src: '/18012397-6DAC-458A-9230-E51DC47747A9.png', sizes: '512x512', type: 'image/png' },
            ],
          });
          navigator.mediaSession.playbackState = 'playing';
          navigator.mediaSession.setActionHandler('play', () => {
            playbackCtxRef.current?.resume().catch(() => {});
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
          });
          navigator.mediaSession.setActionHandler('pause', () => {});
        } catch (msErr) {
          console.warn('MediaSession setup:', msErr);
        }
      }
    }
    if (playbackCtxRef.current.state === 'suspended') {
      playbackCtxRef.current.resume().catch(() => {});
    }
    return playbackCtxRef.current;
  }, [opponentVolume, opponentName]);

  // Play synthesized pleasant pop tone on message receive/send
  const playPopTone = useCallback(() => {
    try {
      const ctx = ensurePlaybackContext();
      if (!ctx || ctx.state === 'suspended') return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.06);
    } catch {
      // Audio playback tone optional
    }
  }, [ensurePlaybackContext]);

  // Test speaker output with a quick melodic chime
  const handleTestSpeaker = () => {
    try {
      setTestToneActive(true);
      const ctx = ensurePlaybackContext();
      ctx.resume().then(() => {
        const now = ctx.currentTime;
        const freqs = [523.25, 659.25, 783.99]; // C5, E5, G5
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);
          gain.gain.setValueAtTime(0.12, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.28);
        });
        setTimeout(() => setTestToneActive(false), 600);
      });
    } catch (err: unknown) {
      setAudioError(err instanceof Error ? err.message : 'Audio test failed');
      setTestToneActive(false);
    }
  };

  // Play incoming PCM audio chunks through scheduled Web Audio nodes
  const playRemoteAudio = useCallback((pcmBase64: string, sampleRate: number) => {
    try {
      const ctx = ensurePlaybackContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const float32 = base64ToFloat32(pcmBase64);
      if (float32.length === 0) return;

      const buffer = ctx.createBuffer(1, float32.length, sampleRate || 16000);
      buffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      if (gainNodeRef.current) {
        source.connect(gainNodeRef.current);
      } else {
        source.connect(ctx.destination);
      }

      // Prevent buffer queue drift and underflow
      const now = ctx.currentTime;
      if (nextPlayTimeRef.current < now || nextPlayTimeRef.current > now + 0.35) {
        nextPlayTimeRef.current = now + 0.02;
      }
      source.start(nextPlayTimeRef.current);
      nextPlayTimeRef.current += buffer.duration;
      source.onended = () => {
        try { source.disconnect(); } catch {}
      };
    } catch (err) {
      console.warn('Audio playback chunk error:', err);
    }
  }, [ensurePlaybackContext]);

  // Adjust opponent volume
  const handleVolumeChange = (vol: number) => {
    setOpponentVolume(vol);
    if (gainNodeRef.current && playbackCtxRef.current) {
      gainNodeRef.current.gain.setValueAtTime(vol, playbackCtxRef.current.currentTime);
    }
  };

  // Socket.io connection & event handling
  useEffect(() => {
    const socket = io('/', { query: { matchId } });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('joinMatch', { matchId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Handle incoming chat messages with strict deduplication
    socket.on('chat', (newMsg: ChatMessage & { matchId?: string }) => {
      if (!newMsg || !newMsg.text) return;
      setMessages((prev) => {
        if (newMsg.id && prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        const isDuplicateContent = prev.some(
          (m) =>
            m.senderId === newMsg.senderId &&
            m.text.trim() === newMsg.text.trim() &&
            Math.abs((m.timestamp || 0) - (newMsg.timestamp || 0)) < 2500
        );
        if (isDuplicateContent) {
          return prev;
        }
        playPopTone();
        return [...prev, newMsg];
      });
    });

    // Mic state indicator
    let speakingTimeout: NodeJS.Timeout | null = null;
    socket.on('mic_state', (data: { userId: string; isSpeaking: boolean }) => {
      if (data.userId !== currentUser.id) {
        setOpponentSpeaking(Boolean(data.isSpeaking));
        if (speakingTimeout) clearTimeout(speakingTimeout);
        if (data.isSpeaking) {
          speakingTimeout = setTimeout(() => setOpponentSpeaking(false), 2000);
        }
      }
    });

    // Remote audio stream
    socket.on('audio_stream', (data: { userId: string; pcm: string; sampleRate: number }) => {
      if (data.userId !== currentUser.id) {
        setOpponentSpeaking(true);
        if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
          playbackCtxRef.current.resume().catch(() => {});
        }
        playRemoteAudio(data.pcm, data.sampleRate);
      }
    });

    // Chat cleared
    socket.on('chat_cleared', () => {
      setMessages([]);
    });

    // Background keep-alive interval
    const keepAliveInterval = setInterval(() => {
      if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
        playbackCtxRef.current.resume().catch(() => {});
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    }, 1000);

    const handleLifecycleChange = () => {
      if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
        playbackCtxRef.current.resume().catch(() => {});
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleLifecycleChange);
    window.addEventListener('pagehide', handleLifecycleChange);
    window.addEventListener('pageshow', handleLifecycleChange);
    window.addEventListener('blur', handleLifecycleChange);
    window.addEventListener('focus', handleLifecycleChange);

    return () => {
      clearInterval(keepAliveInterval);
      document.removeEventListener('visibilitychange', handleLifecycleChange);
      window.removeEventListener('pagehide', handleLifecycleChange);
      window.removeEventListener('pageshow', handleLifecycleChange);
      window.removeEventListener('blur', handleLifecycleChange);
      window.removeEventListener('focus', handleLifecycleChange);
      if (speakingTimeout) clearTimeout(speakingTimeout);
      socket.disconnect();
    };
  }, [matchId, currentUser.id, playPopTone, playRemoteAudio]);

  // Toggle local self-hear loopback
  const toggleLoopback = () => {
    const next = !isLoopbackEnabled;
    setIsLoopbackEnabled(next);
    if (loopbackGainRef.current) {
      loopbackGainRef.current.gain.value = next ? 1.0 : 0.0;
    }
  };

  // Start microphone capture with downsampling and persistent AudioNode references
  const startAudio = async (enableLoopback = false) => {
    setAudioError(null);

    // 1. Check browser mediaDevices support
    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAudioError('Microphone access is not supported by this browser or security context (HTTPS required).');
      setIsMicEnabled(false);
      setIsTestingMic(false);
      return;
    }

    try {
      // CRITICAL FOR iOS: Request microphone IMMEDIATELY as the first async operation
      // This ensures the "user gesture" context is preserved for the hardware trigger.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;

      // 2. Setup playback context (after mic is granted)
      const pCtx = ensurePlaybackContext();
      if (pCtx && pCtx.state === 'suspended') {
        pCtx.resume().catch(() => {});
      }

      // 4. Create AudioContext using native hardware sample rate
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const nativeRate = audioCtx.sampleRate || 48000;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // 5. Setup self-hear loopback gain node
      const loopbackGain = audioCtx.createGain();
      loopbackGain.gain.value = enableLoopback ? 1.0 : 0.0;
      source.connect(loopbackGain);
      loopbackGain.connect(audioCtx.destination);
      loopbackGainRef.current = loopbackGain;
      setIsLoopbackEnabled(enableLoopback);

      // 6. Setup persistent ScriptProcessor (4096 buffer size) stored in ref to prevent GC
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!localStreamRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        if (!inputData || inputData.length === 0) return;

        // Calculate real-time RMS for voice activity & VU meter
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const levelPct = Math.min(100, Math.round(rms * 280));

        // Throttle UI update to ~12 FPS for smooth performance
        const now = Date.now();
        if (now - lastLevelUpdateRef.current > 75) {
          lastLevelUpdateRef.current = now;
          setMicLevel(levelPct);
        }

        const currentlySpeaking = rms > 0.012 && !isMicMuted;
        if (currentlySpeaking !== lastSpeakingStateRef.current) {
          lastSpeakingStateRef.current = currentlySpeaking;
          setIsSpeaking(currentlySpeaking);
          socketRef.current?.emit('mic_state', {
            userId: currentUser.id,
            isSpeaking: currentlySpeaking,
            isMuted: isMicMuted,
            matchId,
          });
        }

        if (isMicMuted) return;

        // Downsample native audio to 16000 Hz and emit over socket
        const downsampled = downsample(inputData, nativeRate, 16000);
        const pcm16 = floatTo16BitPCM(downsampled);
        const pcmBase64 = int16ToBase64(pcm16);

        socketRef.current?.emit('audio_stream', {
          userId: currentUser.id,
          pcm: pcmBase64,
          sampleRate: 16000,
          matchId,
        });
      };

      source.connect(processor);
      const muteGain = audioCtx.createGain();
      muteGain.gain.value = 0.00001;
      processor.connect(muteGain);
      muteGain.connect(audioCtx.destination);

      if ('wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        } catch {}
      }

      if (silentAudioRef.current) {
        silentAudioRef.current.play().catch(() => {});
      }

      setIsMicEnabled(true);
      setIsMicMuted(false);
      socketRef.current?.emit('mic_state', {
        userId: currentUser.id,
        isSpeaking: false,
        isMuted: false,
        matchId,
      });
    } catch (err: unknown) {
      console.error('startAudio error:', err);
      setIsMicEnabled(false);
      setIsTestingMic(false);

      if (err instanceof DOMException || (err && typeof err === 'object' && 'name' in err)) {
        const errName = (err as any).name;
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setAudioError('Microphone is BLOCKED by your browser. Click the lock 🔒 or tune 🎛️ icon in your address bar and set Microphone to "Allow".');
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setAudioError('No microphone detected on your device.');
        } else if (errName === 'NotReadableError' || errName === 'TrackStartError') {
          setAudioError('Microphone is in use by another app (e.g. Call of Duty or Zoom). Close other audio apps and try again.');
        } else if (errName === 'SecurityError') {
          setAudioError('Microphone access restricted by security policy.');
        } else {
          setAudioError(`Microphone error (${errName}): ${err instanceof Error ? err.message : 'Permission denied'}`);
        }
      } else {
        setAudioError('Microphone access denied or blocked in browser settings.');
      }
    }
  };

  // Stop microphone capture
  const stopAudio = () => {
    if (micTestTimeoutRef.current) {
      clearTimeout(micTestTimeoutRef.current);
      micTestTimeoutRef.current = null;
    }
    if (wakeLockRef.current) {
      try {
        wakeLockRef.current.release();
      } catch {}
      wakeLockRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (processorRef.current) {
      try { processorRef.current.disconnect(); } catch {}
      processorRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch {}
      sourceNodeRef.current = null;
    }
    if (loopbackGainRef.current) {
      try { loopbackGainRef.current.disconnect(); } catch {}
      loopbackGainRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
    setIsMicEnabled(false);
    setIsLoopbackEnabled(false);
    setIsTestingMic(false);
    setMicLevel(0);
    setIsSpeaking(false);
    socketRef.current?.emit('mic_state', {
      userId: currentUser.id,
      isSpeaking: false,
      isMuted: true,
      matchId,
    });
  };

  // Run a 6-second live microphone self-test
  const handleTestMic = async () => {
    if (isTestingMic || isMicEnabled) {
      stopAudio();
      return;
    }
    setIsTestingMic(true);
    await startAudio(true);
    micTestTimeoutRef.current = setTimeout(() => {
      setIsTestingMic(false);
      stopAudio();
    }, 6000);
  };

  // Toggle mic mute
  const toggleMicMute = () => {
    const nextMuted = !isMicMuted;
    setIsMicMuted(nextMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    socketRef.current?.emit('mic_state', {
      userId: currentUser.id,
      isSpeaking: false,
      isMuted: nextMuted,
      matchId,
    });
  };

  // Send in-match text message with client-side deduplication lock
  const handleSendMessage = () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    const newMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      senderId: currentUser.id,
      senderName: currentUser.codmIgn || currentUser.username || 'You',
      text,
      timestamp: Date.now(),
    };

    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    setInputText('');
    playPopTone();

    socketRef.current?.emit('chat', {
      id: newMsg.id,
      text: newMsg.text,
      matchId,
      senderId: newMsg.senderId,
      senderName: newMsg.senderName,
      timestamp: newMsg.timestamp,
    });

    setTimeout(() => {
      setIsSending(false);
    }, 250);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat
  const handleClearChat = () => {
    if (window.confirm('Clear all chat messages for this match lobby?')) {
      socketRef.current?.emit('clear_chat', { matchId });
      setMessages([]);
    }
  };

  return (
    <div className="flex flex-col h-[520px] bg-[#0c1317] rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden font-sans select-none">
      {/* Hidden silent loop audio to keep mobile background execution active */}
      <audio
        ref={silentAudioRef}
        loop
        playsInline
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        className="hidden"
      />

      {/* Hidden live MediaStream audio element to preserve background audio session */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />

      {/* WhatsApp Header */}
      <div className="px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942] flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-emerald-500/30">
              {opponentName ? opponentName.charAt(0).toUpperCase() : 'O'}
            </div>
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1f2c34] ${
                isConnected ? 'bg-emerald-400' : 'bg-neutral-500'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wide">
                {opponentName}
              </span>
              {opponentSpeaking && (
                <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium animate-pulse">
                  <Radio size={12} className="animate-spin" />
                  <span>speaking...</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#8696a0]">
              <span className="text-emerald-400 font-medium">
                {isConnected ? 'online' : 'connecting...'}
              </span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Shield size={11} className="text-amber-400" />
                <span>Escrow Match</span>
              </span>
            </div>
          </div>
        </div>

        {/* Tactical Voice & Comms Controls */}
        <div className="flex items-center gap-1.5">
          {/* Test Speaker Button */}
          <button
            onClick={handleTestSpeaker}
            title="Test Speaker & Unmute Audio"
            className={`px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
              testToneActive
                ? 'bg-amber-500 text-neutral-950 ring-2 ring-amber-300'
                : 'bg-[#2a3942] hover:bg-[#374248] text-[#d1d7db]'
            }`}
          >
            <Sparkles size={13} className={testToneActive ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Test Audio</span>
          </button>

          {/* Test Mic Button */}
          {!isMicEnabled && (
            <button
              onClick={handleTestMic}
              title="Test live microphone recording & hear yourself"
              className={`px-2.5 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                isTestingMic
                  ? 'bg-emerald-500 text-neutral-950 ring-2 ring-emerald-300 animate-pulse font-bold'
                  : 'bg-[#2a3942] hover:bg-[#374248] text-[#d1d7db]'
              }`}
            >
              <Headphones size={13} />
              <span className="hidden sm:inline">{isTestingMic ? 'Testing Mic...' : 'Test Mic'}</span>
            </button>
          )}

          {/* Opponent Volume Slider */}
          {isMicEnabled && (
            <div className="hidden sm:flex items-center gap-1 bg-[#2a3942] px-2 py-1 rounded-full text-xs text-[#8696a0]">
              <Volume2 size={13} className="text-emerald-400" />
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={opponentVolume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-14 accent-emerald-500 h-1 bg-neutral-700 rounded-lg cursor-pointer"
              />
            </div>
          )}

          {/* Microphone Mute/Unmute toggle */}
          {isMicEnabled && (
            <button
              onClick={toggleMicMute}
              title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
              className={`p-2 rounded-full transition-all ${
                isMicMuted
                  ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
              }`}
            >
              {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
          )}

          {/* Voice Chat On/Off Toggle Button */}
          <button
            onClick={isMicEnabled ? stopAudio : () => startAudio(false)}
            disabled={isSettled}
            title={isMicEnabled ? 'Leave Voice Room' : 'Join Voice Chat'}
            className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              isMicEnabled
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {isMicEnabled ? (
              <>
                <VolumeX size={14} />
                <span>Leave Mic</span>
              </>
            ) : (
              <>
                <Mic size={14} />
                <span>Voice Comms</span>
              </>
            )}
          </button>

          {/* Clear chat button */}
          <button
            onClick={handleClearChat}
            title="Clear Chat History"
            className="p-1.5 rounded-full text-[#8696a0] hover:text-white hover:bg-[#2a3942] transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Live Voice Status Pill Banner with Real-Time VU Meter */}
      {isMicEnabled && (
        <div className="bg-emerald-950/80 border-b border-emerald-800/40 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-300">
          <div className="flex items-center gap-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${isSpeaking ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'}`} />
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">
                {isMicMuted ? 'Mic Muted' : isSpeaking ? '🎙️ Broadcasting Voice...' : 'Mic Ready (Listening)'}
              </span>

              {/* Real-time input volume meter */}
              {!isMicMuted && (
                <div className="flex items-center gap-1.5 bg-neutral-900/90 px-2 py-0.5 rounded-md border border-emerald-500/30">
                  <span className="text-[10px] text-neutral-400 font-mono">Input:</span>
                  <div className="w-16 h-2 bg-neutral-800 rounded-full overflow-hidden flex items-center">
                    <div
                      className={`h-full transition-all duration-75 rounded-full ${
                        micLevel > 60 ? 'bg-amber-400' : micLevel > 15 ? 'bg-emerald-400' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${Math.max(4, micLevel)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{micLevel}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle Hear Myself (Loopback) */}
            <button
              onClick={toggleLoopback}
              title="Hear your microphone in your headset/speaker to verify recording"
              className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                isLoopbackEnabled
                  ? 'bg-amber-500 text-neutral-950 ring-1 ring-amber-300 font-bold'
                  : 'bg-[#2a3942] hover:bg-[#374248] text-neutral-300'
              }`}
            >
              <Headphones size={12} />
              <span>{isLoopbackEnabled ? 'Mute Self-Hear' : 'Hear Myself'}</span>
            </button>

            <span className="text-[10px] text-emerald-400/80 font-mono uppercase">
              {isMicMuted ? 'MUTED' : 'LIVE'}
            </span>
          </div>
        </div>
      )}

      {audioError && (
        <div className="bg-rose-950/90 border-b border-rose-800/80 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-rose-200">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <AlertCircle size={15} className="text-rose-400 shrink-0" />
            <span className="leading-snug">{audioError}</span>
          </div>
          <button
            onClick={() => startAudio(false)}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[11px] uppercase tracking-wider shrink-0 transition-all cursor-pointer shadow"
          >
            Retry Mic
          </button>
        </div>
      )}

      {/* WhatsApp Chat Canvas */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#0b141a] relative">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#25d366_1px,transparent_1px)] [background-size:16px_16px]" />

        {/* Encrypted Referee Notification Badge */}
        <div className="flex justify-center my-2">
          <div className="bg-[#182229]/90 border border-neutral-800 text-[#8696a0] text-[11px] px-3.5 py-1.5 rounded-xl shadow text-center max-w-[90%] flex items-center gap-1.5">
            <Shield size={12} className="text-amber-400 shrink-0" />
            <span>
              🔒 Messages are escrow-verified and auto-purged on match settlement.
            </span>
          </div>
        </div>

        {/* Message Feed */}
        {messages.map((m, idx) => {
          const isMe = m.senderId === currentUser.id;
          const isSystem = m.senderId === 'SYSTEM';

          if (isSystem) {
            return (
              <div key={m.id || `sys_${idx}`} className="flex justify-center my-2">
                <div className="bg-[#182229] border border-amber-500/30 text-amber-300 text-xs px-3.5 py-1.5 rounded-xl text-center shadow max-w-[90%]">
                  <p className="font-medium">{m.text}</p>
                </div>
              </div>
            );
          }

          return (
            <div
              key={m.id || `msg_${idx}`}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'} transition-opacity animate-in fade-in`}
            >
              <div
                className={`p-2.5 rounded-2xl shadow-md max-w-[85%] sm:max-w-[75%] relative group ${
                  isMe
                    ? 'bg-[#005c4b] text-white rounded-tr-xs'
                    : 'bg-[#202c33] text-[#e9edef] rounded-tl-xs border border-[#2a3942]/60'
                }`}
              >
                {!isMe && (
                  <p className="text-[11px] font-bold text-amber-400 mb-0.5">
                    {m.senderName || opponentName}
                  </p>
                )}
                <p className="text-xs sm:text-sm leading-relaxed pr-14 break-words whitespace-pre-wrap">
                  {m.text}
                </p>
                <div className="absolute bottom-1.5 right-2 flex items-center gap-1 text-[10px] text-[#8696a0]">
                  <span>{formatTime(m.timestamp)}</span>
                  {isMe && <CheckCheck size={13} className="text-emerald-300" />}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* WhatsApp Input Bar */}
      <div className="p-3 bg-[#1f2c34] border-t border-[#2a3942] flex items-center gap-2 z-10 shrink-0">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSettled}
          placeholder={isSettled ? 'Match settled (chat closed)' : 'Type a tactical message...'}
          className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] rounded-full px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all border border-transparent focus:border-emerald-500/50"
        />

        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim() || isSending || isSettled}
          className="p-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:hover:bg-emerald-600 text-white rounded-full transition-all shadow-md flex items-center justify-center shrink-0 cursor-pointer active:scale-95"
          title="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
