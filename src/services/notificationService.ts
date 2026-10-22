// Real-Time Browser & Mobile Phone Notification Service for CODM Stake 1v1

export interface NotificationPayload {
  id?: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  soundType?: 'rival_joined' | 'match_started' | 'disputed' | 'settled' | 'default';
  data?: {
    matchId?: string;
    url?: string;
    type?: string;
    [key: string]: unknown;
  };
}

const NOTIFICATION_ICON = '/18012397-6DAC-458A-9230-E51DC47747A9.png';

// Service Worker Registration reference
let swRegistration: ServiceWorkerRegistration | null = null;
let audioContext: AudioContext | null = null;

// Detect iOS devices (iPhone, iPad, iPod)
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

// Detect if app is currently installed/running in standalone PWA mode
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

// Initialize Notification Service Worker
export async function initNotificationService(): Promise<void> {
  if (typeof window === 'undefined') return;

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      swRegistration = reg;
    } catch (err) {
      console.warn('Service worker registration failed:', err);
    }
  }
}

// Request Notification Permission (supports both promise and callback formats)
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined') {
    return 'denied';
  }

  // If on iPhone and not installed as Home Screen PWA, trigger the interactive iOS guide
  if (isIOS() && (!isStandalone() || !('Notification' in window))) {
    window.dispatchEvent(new CustomEvent('codm_show_ios_pwa_guide'));
    return 'default';
  }

  if (!('Notification' in window)) {
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      playAlertAudio('rival_joined');
      showBrowserNotification({
        title: '🔔 Notifications Enabled!',
        body: 'You will receive instant alerts on your phone when rivals join or matches start.',
        soundType: 'rival_joined',
      });
    }
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

// Check current notification permission
export function getNotificationPermission(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

// Play distinctive Web Audio chimes for each game event
export function playAlertAudio(type: 'rival_joined' | 'match_started' | 'disputed' | 'settled' | 'default' = 'default'): void {
  try {
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;

    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtxClass();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const now = audioContext.currentTime;
    const ctx = audioContext;

    if (type === 'rival_joined') {
      // Energetic 3-tone battle fanfare (C5 -> E5 -> G5)
      const freqs = [523.25, 659.25, 783.99];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0.08, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.24);
      });
    } else if (type === 'match_started') {
      // Heavy combat powerup horn (G3 -> C4 -> G4)
      const freqs = [196.0, 261.63, 392.0];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);
        gain.gain.setValueAtTime(0.12, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.38);
      });
    } else if (type === 'disputed') {
      // Urgent warning pulse
      [880, 660, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0.06, now + idx * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.11);
      });
    } else if (type === 'settled') {
      // Victorious trophy coins chime (D5 -> F#5 -> A5 -> D6)
      const freqs = [587.33, 739.99, 880.0, 1174.66];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.07);
        gain.gain.setValueAtTime(0.1, now + idx * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.07);
        osc.stop(now + idx * 0.07 + 0.32);
      });
    } else {
      // Standard pleasant pop tone
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    }
  } catch {
    // Audio alert fallback
  }
}

// Display native browser / phone notification
export async function showBrowserNotification(payload: NotificationPayload): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Play sound & vibrate on phone
  playAlertAudio(payload.soundType || 'default');
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200, 100, 250]);
    } catch {
      // Vibration not supported
    }
  }

  // 2. Check notification permissions
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return false;
  }

  const notificationOptions: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || NOTIFICATION_ICON,
    badge: payload.badge || NOTIFICATION_ICON,
    tag: payload.tag || `codm_alert_${Date.now()}`,
    data: payload.data || { url: '/arena' },
    requireInteraction: true,
  };

  try {
    // First, try Service Worker registration (critical for Android Chrome and iOS Safari PWAs)
    if ('serviceWorker' in navigator) {
      const reg = swRegistration || (await navigator.serviceWorker.ready);
      if (reg && 'showNotification' in reg) {
        await reg.showNotification(payload.title, notificationOptions);
        return true;
      }
    }

    // Fallback: standard Web Notification constructor
    const notification = new Notification(payload.title, notificationOptions);
    notification.onclick = (e) => {
      e.preventDefault();
      window.focus();
      const url = payload.data?.url || '/arena';
      if (window.location.pathname !== url) {
        window.location.href = url;
      }
      notification.close();
    };
    return true;
  } catch (err) {
    console.warn('Native notification display failed:', err);
    return false;
  }
}
