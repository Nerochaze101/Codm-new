import { useState, useEffect, useRef } from 'react';
import { getSharedAudioContext, unlockAudio } from '../services/audioUnlockService';

const SOUND_STORAGE_KEY = 'codm_sound_enabled';
const SOUND_EVENT_NAME = 'codm_sound_setting_changed';

/**
 * Returns whether global sound FX are enabled (default: true)
 */
export const getSoundEnabled = (): boolean => {
  if (typeof window === 'undefined') return true;
  const stored = localStorage.getItem(SOUND_STORAGE_KEY);
  return stored === null ? true : stored !== 'false';
};

/**
 * Sets whether global sound FX are enabled and notifies listeners
 */
export const setSoundEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOUND_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(SOUND_EVENT_NAME, { detail: enabled }));
};

/**
 * Hook to read and toggle sound settings with live synchronization across components
 */
export const useSoundSettings = () => {
  const [soundEnabled, setSoundState] = useState<boolean>(() => getSoundEnabled());

  useEffect(() => {
    const handleSettingChange = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      if (customEvent.detail !== undefined) {
        setSoundState(customEvent.detail);
      } else {
        setSoundState(getSoundEnabled());
      }
    };

    window.addEventListener(SOUND_EVENT_NAME, handleSettingChange);
    window.addEventListener('storage', handleSettingChange);
    return () => {
      window.removeEventListener(SOUND_EVENT_NAME, handleSettingChange);
      window.removeEventListener('storage', handleSettingChange);
    };
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundState(next);
    setSoundEnabled(next);
    if (next) {
      // Provide instant audio feedback when user turns sound on
      playShotgunSound();
    }
  };

  const updateSound = (enabled: boolean) => {
    setSoundState(enabled);
    setSoundEnabled(enabled);
    if (enabled) {
      playShotgunSound();
    }
  };

  return {
    soundEnabled,
    toggleSound,
    setSoundEnabled: updateSound,
  };
};

/**
 * Plays the tactical 12-gauge shotgun blast interaction sound
 */
export const playShotgunSound = (): void => {
  if (typeof window === 'undefined') return;
  if (!getSoundEnabled()) return;

  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        unlockAudio(ctx);
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;

      // 1. Muzzle blast transient (filtered white noise crack)
      const duration = 0.35;
      const bufferSize = Math.floor(ctx.sampleRate * duration);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        const t = i / ctx.sampleRate;
        const decay = Math.exp(-t * 26);
        data[i] = (Math.random() * 2 - 1) * decay;
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(4500, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(320, now + duration);

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.75, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noiseSource.start(now);

      // 2. Heavy sub-bass body thump (triangle wave rapid frequency dive)
      const punchOsc = ctx.createOscillator();
      punchOsc.type = 'triangle';
      punchOsc.frequency.setValueAtTime(200, now);
      punchOsc.frequency.exponentialRampToValueAtTime(36, now + 0.22);

      const punchGain = ctx.createGain();
      punchGain.gain.setValueAtTime(0.85, now);
      punchGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      punchOsc.connect(punchGain);
      punchGain.connect(ctx.destination);
      punchOsc.start(now);
      punchOsc.stop(now + 0.28);

      // 3. Tactical pump-action cocking click at ~90ms
      const clickOsc = ctx.createOscillator();
      const clickGain = ctx.createGain();
      clickOsc.type = 'sawtooth';
      clickOsc.frequency.setValueAtTime(750, now + 0.08);
      clickOsc.frequency.exponentialRampToValueAtTime(280, now + 0.14);

      clickGain.gain.setValueAtTime(0.0001, now);
      clickGain.gain.setValueAtTime(0.2, now + 0.08);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      clickOsc.connect(clickGain);
      clickGain.connect(ctx.destination);
      clickOsc.start(now + 0.08);
      clickOsc.stop(now + 0.16);
      return;
    }
  } catch (err) {
    console.debug('Web Audio synthesis fallback:', err);
  }

  // Fallback to audio element if Web Audio API failed
  try {
    const audio = new Audio('/assets/audio/shotgun.mp3');
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch (e) {
    console.debug('Audio element fallback failed:', e);
  }
};

/**
 * Hook for playing audio files or tactical SFX with global mute respect
 */
export const useSound = (url?: string) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (url) {
      audioRef.current = new Audio(url);
    }
  }, [url]);

  const play = () => {
    if (!getSoundEnabled()) return;

    if (url && (url.includes('shotgun') || url.endsWith('.mp3'))) {
      // Use optimal low-latency synthesizer
      playShotgunSound();
      return;
    }

    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // If file fails, fallback to synthesizer
        playShotgunSound();
      });
    } else {
      playShotgunSound();
    }
  };

  return play;
};
