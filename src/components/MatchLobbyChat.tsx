import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserProfile, ChatMessage } from '../types';
import {
  Send, Mic, MicOff, Volume2, VolumeX, Shield, Trash2,
  Check, CheckCheck, Radio, Sparkles, RefreshCw, AlertCircle
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { unlockAudio, isAudioUnlocked } from '../services/audioUnlockService';
import { showBrowserNotification } from '../services/notificationService';

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

  // Initialize playback AudioContext on first interaction or mount
  const ensurePlaybackContext = useCallback(() => {
    if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass({ sampleRate: 16000 });
      const gain = ctx.createGain();
      gain.gain.value = opponentVolume;

      // 1. Create MediaStream destination for HTML5 <audio> tag
      // This is the core mechanism that keeps mobile OS (iOS mediaserverd & Android) playing audio when minimized into CODM
      const dest = ctx.createMediaStreamDestination();
      gain.connect(dest);
      gain.connect(ctx.destination);
      streamDestRef.current = dest;

      // 2. Connect continuous sub-audible carrier (12 Hz at 0.00005 gain)
      // Prevents mobile OS from terminating the audio stream on silence when neither player is speaking
      try {
        const carrierOsc = ctx.createOscillator();
        const carrierGain = ctx.createGain();
        carrierOsc.type = 'sine';
        carrierOsc.frequency.setValueAtTime(12, ctx.currentTime);
        carrierGain.gain.setValueAtTime(0.00005, ctx.currentTime);
        carrierOsc.connect(carrierGain);
        carrierGain.connect(dest);
        carrierGain.connect(ctx.destination);
        carrierOsc.start();
        carrierOscRef.current = carrierOsc;
      } catch (cErr) {
        console.warn('Carrier tone init:', cErr);
      }

      gainNodeRef.current = gain;
      playbackCtxRef.current = ctx;

      // 3. Attach MediaStream to <audio playsInline autoPlay>
      if (remoteAudioRef.current && dest.stream) {
        remoteAudioRef.current.srcObject = dest.stream;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
    if (playbackCtxRef.current.state === 'suspended') {
      playbackCtxRef.current.resume().catch(() => {});
    }
    if (remoteAudioRef.current && remoteAudioRef.current.paused && remoteAudioRef.current.srcObject) {
      remoteAudioRef.current.play().catch(() => {});
    }
    return playbackCtxRef.current;
  }, [opponentVolume]);

  // Mobile Safari User Gesture Audio Unlock
  // Forces Web Audio context & HTML5 audio pipeline initialization on first interaction
  useEffect(() => {
    const handleGestureUnlock = async () => {
      await unlockAudio(playbackCtxRef.current);
      ensurePlaybackContext();
    };

    const gestureEvents = ['touchstart', 'touchend', 'click', 'keydown'];
    gestureEvents.forEach((ev) => {
      window.addEventListener(ev, handleGestureUnlock, { capture: true, passive: true, once: true });
      document.addEventListener(ev, handleGestureUnlock, { capture: true, passive: true, once: true });
    });

    return () => {
      gestureEvents.forEach((ev) => {
        window.removeEventListener(ev, handleGestureUnlock, { capture: true } as EventListenerOptions);
        document.removeEventListener(ev, handleGestureUnlock, { capture: true } as EventListenerOptions);
      });
    };
  }, [ensurePlaybackContext]);

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
  const handleTestSpeaker = async () => {
    try {
      setTestToneActive(true);
      await unlockAudio(playbackCtxRef.current);
      const ctx = ensurePlaybackContext();
      await ctx.resume();
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

      // Ensure remote audio element is actively playing the stream
      if (remoteAudioRef.current && (!remoteAudioRef.current.srcObject || remoteAudioRef.current.paused)) {
        if (streamDestRef.current?.stream) {
          remoteAudioRef.current.srcObject = streamDestRef.current.stream;
        }
        remoteAudioRef.current.play().catch(() => {});
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

      // Schedule smoothly along timeline to eliminate clipping/stutter
      const currentTime = ctx.currentTime;
      const scheduledTime = Math.max(currentTime, nextPlayTimeRef.current);
      source.start(scheduledTime);
      nextPlayTimeRef.current = scheduledTime + buffer.duration;
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
        // 1. Check ID uniqueness
        if (newMsg.id && prev.some((m) => m.id === newMsg.id)) {
          return prev;
        }
        // 2. Check content + timestamp match within 2.5s (prevents local/remote duplicate echo)
        const isDuplicateContent = prev.some(
          (m) =>
            m.senderId === newMsg.senderId &&
            m.text.trim() === newMsg.text.trim() &&
            Math.abs((m.timestamp || 0) - (newMsg.timestamp || 0)) < 2500
        );
        if (isDuplicateContent) {
          return prev;
        }

        // Trigger phone & lock-screen push notification when opponent sends a chat message
        if (newMsg.senderId !== currentUser.id && newMsg.senderId !== 'SYSTEM') {
          showBrowserNotification({
            id: `chat_push_${newMsg.id}`,
            title: `💬 ${newMsg.senderName || opponentName} (Match Chat)`,
            body: newMsg.text,
            soundType: 'default',
            tag: `codm_chat_${matchId}`,
            data: {
              matchId,
              url: '/arena',
            },
          });
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

    // Background keep-alive interval for persistent voice comms when minimized to play CODM
    const keepAliveInterval = setInterval(() => {
      if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
        playbackCtxRef.current.resume().catch(() => {});
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      if (remoteAudioRef.current && remoteAudioRef.current.paused && remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.play().catch(() => {});
      }
    }, 1000);

    // Auto-resume audio across all browser lifecycle transitions
    const handleLifecycleChange = () => {
      if (playbackCtxRef.current && playbackCtxRef.current.state === 'suspended') {
        playbackCtxRef.current.resume().catch(() => {});
      }
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      if (remoteAudioRef.current && remoteAudioRef.current.paused && remoteAudioRef.current.srcObject) {
        remoteAudioRef.current.play().catch(() => {});
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

  // Start microphone capture using AudioWorklet (with fallback to ScriptProcessor)
  const startAudio = async () => {
    setAudioError(null);
    try {
      // 0. Force unlock Web Audio context inside this user gesture (iOS Safari requirement)
      await unlockAudio(playbackCtxRef.current);

      // 1. Request screen wake lock to prevent mobile device sleep during active match
      if ('wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          wakeLockRef.current.addEventListener('release', () => {
            wakeLockRef.current = null;
          });
        } catch {
          // Wake lock optional
        }
      }

      // 2. Ensure playback pipeline & MediaStream destination are primed
      const pCtx = ensurePlaybackContext();
      if (pCtx && pCtx.state === 'suspended') {
        await pCtx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });
      localStreamRef.current = stream;

      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioCtxClass({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);

      // Attempt AudioWorklet for dedicated background thread processing
      let workletSuccess = false;
      try {
        await audioCtx.audioWorklet.addModule('/audio-processor.js');
        const workletNode = new AudioWorkletNode(audioCtx, 'audio-processor');
        source.connect(workletNode);
        const muteGain = audioCtx.createGain();
        muteGain.gain.value = 0.00001; // Tiny non-zero gain prevents mobile WebKit from pruning node graph
        workletNode.connect(muteGain);
        muteGain.connect(audioCtx.destination);

        workletNode.port.onmessage = (e) => {
          if (!socketRef.current || isMicMuted) return;
          const floatData = e.data as Float32Array;
          if (!floatData || floatData.length === 0) return;

          // Check if user is actively speaking (amplitude threshold)
          let sum = 0;
          for (let i = 0; i < floatData.length; i++) sum += floatData[i] * floatData[i];
          const rms = Math.sqrt(sum / floatData.length);
          if (rms > 0.015) {
            socketRef.current.emit('mic_state', {
              userId: currentUser.id,
              isSpeaking: true,
              matchId,
            });
          }

          const pcm = int16ToBase64(floatTo16BitPCM(floatData));
          socketRef.current.emit('audio_stream', {
            userId: currentUser.id,
            pcm,
            sampleRate: 16000,
            matchId,
          });
        };
        workletSuccess = true;
      } catch (workletErr) {
        console.warn('AudioWorklet load fallback to ScriptProcessor:', workletErr);
      }

      // Safe fallback if AudioWorklet was not available
      if (!workletSuccess) {
        const processor = audioCtx.createScriptProcessor(2048, 1, 1);
        source.connect(processor);
        const muteGain = audioCtx.createGain();
        muteGain.gain.value = 0.00001;
        processor.connect(muteGain);
        muteGain.connect(audioCtx.destination);

        processor.onaudioprocess = (e) => {
          if (!socketRef.current || isMicMuted) return;
          const floatData = e.inputBuffer.getChannelData(0);
          const pcm = int16ToBase64(floatTo16BitPCM(floatData));
          socketRef.current.emit('audio_stream', {
            userId: currentUser.id,
            pcm,
            sampleRate: 16000,
            matchId,
          });
        };
      }

      // Start silent loop audio element to keep mobile background thread awake
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
      const msg = err instanceof Error ? err.message : 'Microphone access denied';
      setAudioError(msg);
      setIsMicEnabled(false);
    }
  };

  // Stop microphone capture
  const stopAudio = () => {
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
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
    setIsMicEnabled(false);
    socketRef.current?.emit('mic_state', {
      userId: currentUser.id,
      isSpeaking: false,
      isMuted: true,
      matchId,
    });
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

  // Media Session API Integration
  // Manages lock-screen, control center, and Bluetooth headset playback controls & metadata
  // Ensures iOS Safari mediaserverd and Android AudioFlinger recognize the match audio stream as active media even in the background
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    try {
      const statusText = !isMicEnabled
        ? 'Listening'
        : isMicMuted
        ? 'Mic Muted'
        : 'Live';

      navigator.mediaSession.metadata = new MediaMetadata({
        title: `CODM 1v1 Comms (${statusText})`,
        artist: `1v1 Match vs ${opponentName}`,
        album: 'CODM Stake Arena · Refereed Room',
        artwork: [
          { src: '/18012397-6DAC-458A-9230-E51DC47747A9.png', sizes: '96x96', type: 'image/png' },
          { src: '/18012397-6DAC-458A-9230-E51DC47747A9.png', sizes: '128x128', type: 'image/png' },
          { src: '/18012397-6DAC-458A-9230-E51DC47747A9.png', sizes: '192x192', type: 'image/png' },
          { src: '/18012397-6DAC-458A-9230-E51DC47747A9.png', sizes: '256x256', type: 'image/png' },
          { src: '/18012397-6DAC-458A-9230-E51DC47747A9.png', sizes: '512x512', type: 'image/png' },
        ],
      });

      // Maintain 'playing' state so mobile browsers treat audio as active media
      navigator.mediaSession.playbackState = 'playing';

      // Lock screen Play: resume AudioContext and ensure media playback
      navigator.mediaSession.setActionHandler('play', async () => {
        await unlockAudio(playbackCtxRef.current);
        if (playbackCtxRef.current?.state === 'suspended') {
          await playbackCtxRef.current.resume().catch(() => {});
        }
        if (remoteAudioRef.current && remoteAudioRef.current.paused && remoteAudioRef.current.srcObject) {
          await remoteAudioRef.current.play().catch(() => {});
        }
        if (isMicEnabled && isMicMuted) {
          toggleMicMute();
        }
        navigator.mediaSession.playbackState = 'playing';
      });

      // Lock screen Pause: toggle mic mute without dropping opponent incoming audio
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isMicEnabled && !isMicMuted) {
          toggleMicMute();
        }
      });

      // Lock screen Stop: leaves voice room or pauses comms
      navigator.mediaSession.setActionHandler('stop', () => {
        if (isMicEnabled) {
          stopAudio();
        }
      });

      // Headset & lock screen microphone toggle action (AirPods stem click, Bluetooth headset button)
      try {
        navigator.mediaSession.setActionHandler('togglemicrophone' as any, () => {
          if (isMicEnabled) {
            toggleMicMute();
          } else {
            startAudio();
          }
        });
      } catch {}

      // VoIP Call hangup action
      try {
        navigator.mediaSession.setActionHandler('hangup' as any, () => {
          if (isMicEnabled) {
            stopAudio();
          }
        });
      } catch {}
    } catch (msErr) {
      console.warn('[MediaSession] Configuration error:', msErr);
    }
  }, [isMicEnabled, isMicMuted, opponentName]);

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

    // Optimistically append locally (safely guarded)
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });

    setInputText('');
    playPopTone();

    // Broadcast over Socket.io
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
    <div
      onClick={() => {
        unlockAudio(playbackCtxRef.current);
        ensurePlaybackContext();
      }}
      onTouchStart={() => {
        unlockAudio(playbackCtxRef.current);
        ensurePlaybackContext();
      }}
      className="flex flex-col h-[520px] bg-[#0c1317] rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden font-sans select-none"
    >
      {/* Hidden silent loop audio to keep mobile background execution active */}
      <audio
        ref={silentAudioRef}
        loop
        playsInline
        src="data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA"
        className="hidden"
      />

      {/* Hidden live MediaStream audio element to preserve background audio session when minimized in CODM */}
      <audio
        ref={remoteAudioRef}
        autoPlay
        playsInline
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
          {/* Test Speaker Button (Unmutes & unblocks mobile autoplay) */}
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

          {/* Opponent Volume Slider (when mic is active) */}
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
            onClick={isMicEnabled ? stopAudio : startAudio}
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

      {/* Voice Status Pill Banner */}
      {isMicEnabled && (
        <div className="bg-emerald-950/70 border-b border-emerald-800/40 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-medium">
              Live Voice Comms Active · Background audio enabled for playing Call of Duty: Mobile
            </span>
          </div>
          <span className="text-[11px] text-emerald-400/80 font-mono">
            {isMicMuted ? 'MUTED' : 'LIVE'}
          </span>
        </div>
      )}

      {audioError && (
        <div className="bg-rose-950/80 border-b border-rose-800/60 px-4 py-1.5 flex items-center gap-2 text-xs text-rose-300">
          <AlertCircle size={14} />
          <span>{audioError} - Tap &quot;Test Audio&quot; to allow browser audio permissions.</span>
        </div>
      )}

      {/* WhatsApp Chat Canvas with subtle dark texture */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 bg-[#0b141a] relative">
        {/* Subtle background decoration */}
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
