// Mobile Safari & Web Audio Unlock Service
// iOS Safari strictly prohibits Web Audio and HTML5 audio auto-play unless triggered
// synchronously inside a valid user gesture (touchstart, touchend, click, keydown).

let audioContextInstance: AudioContext | null = null;
let isUnlocked = false;
let unlockPromise: Promise<boolean> | null = null;

// Get or initialize the shared AudioContext
export function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioContextInstance || audioContextInstance.state === 'closed') {
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtxClass) {
      audioContextInstance = new AudioCtxClass();
    }
  }
  return audioContextInstance;
}

// Check if audio has been unlocked via user gesture
export function isAudioUnlocked(): boolean {
  return isUnlocked && audioContextInstance !== null && audioContextInstance.state === 'running';
}

// Unlock Web Audio context and HTML5 media playback on mobile Safari
export async function unlockAudio(targetCtx?: AudioContext | null): Promise<boolean> {
  console.log('unlockAudio called');
  if (typeof window === 'undefined') return false;

  if (isUnlocked && (!targetCtx || targetCtx.state === 'running')) {
    return true;
  }

  if (unlockPromise) {
    return unlockPromise;
  }

  unlockPromise = (async () => {
    try {
      const ctx = targetCtx || getSharedAudioContext();
      if (!ctx) return false;

      // 1. Resume AudioContext
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      // 2. Play a 1-sample silent Web Audio buffer to satisfy iOS auto-play policy
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      // 3. Play a tiny silent HTML5 audio element to unlock background media pipeline on iOS
      try {
        const silentAudio = document.createElement('audio');
        silentAudio.setAttribute('playsinline', '');
        silentAudio.setAttribute('webkit-playsinline', '');
        silentAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        silentAudio.volume = 0.01;
        const playPromise = silentAudio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              silentAudio.pause();
              silentAudio.remove();
            })
            .catch(() => {
              // Non-blocking fallback
            });
        }
      } catch {
        // Audio element fallback
      }

      if (ctx.state === 'running') {
        isUnlocked = true;
        window.dispatchEvent(new CustomEvent('codm_audio_unlocked'));
        return true;
      }

      return false;
    } catch (err) {
      console.warn('[AudioUnlock] Could not unlock audio context:', err);
      return false;
    } finally {
      unlockPromise = null;
    }
  })();

  return unlockPromise;
}

// Global user-gesture handler that unlocks audio on the very first tap/click on mobile Safari
export function initMobileAudioUnlock(): void {
  if (typeof window === 'undefined') return;

  const userGestureEvents = ['touchstart', 'touchend', 'click', 'keydown'];

  const onUserGesture = async () => {
    const success = await unlockAudio();
    if (success || isUnlocked) {
      // Remove listeners once unlocked
      userGestureEvents.forEach((eventType) => {
        window.removeEventListener(eventType, onUserGesture, { capture: true } as EventListenerOptions);
        document.removeEventListener(eventType, onUserGesture, { capture: true } as EventListenerOptions);
      });
    }
  };

  userGestureEvents.forEach((eventType) => {
    window.addEventListener(eventType, onUserGesture, { capture: true, passive: true, once: false });
    document.addEventListener(eventType, onUserGesture, { capture: true, passive: true, once: false });
  });
}

// Auto-initialize unlock listeners in browser environment
if (typeof window !== 'undefined') {
  initMobileAudioUnlock();
}
