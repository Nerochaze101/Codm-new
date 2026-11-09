import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Megaphone, Sparkles, X } from 'lucide-react';
import { io } from 'socket.io-client';

export interface BroadcastData {
  id: string;
  message: string;
  type: 'info' | 'warning' | 'urgent' | 'success';
  active: boolean;
  createdAt: number;
}

export const GlobalBroadcastBanner: React.FC = () => {
  const [broadcast, setBroadcast] = useState<BroadcastData | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Fetch active broadcast from REST API
    const fetchActiveBroadcast = async () => {
      try {
        const res = await fetch('/api/broadcast');
        const data = await res.json();
        if (data && data.broadcast) {
          setBroadcast(data.broadcast);
        } else {
          setBroadcast(null);
        }
      } catch (err) {
        console.error('Failed to fetch global broadcast:', err);
      }
    };
    fetchActiveBroadcast();

    // 2. Connect to Socket.IO for instant live updates
    const socket = io();
    socket.on('global_broadcast', (payload: BroadcastData | null) => {
      if (payload && payload.active) {
        setBroadcast(payload);
        setDismissedId(null); // Reset local dismissal when new announcement arrives
      } else {
        setBroadcast(null);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  if (!broadcast || !broadcast.message || broadcast.id === dismissedId) {
    return null;
  }

  const getTheme = () => {
    switch (broadcast.type) {
      case 'urgent':
        return {
          bg: 'bg-rose-950/90 border-rose-500/60 text-rose-200',
          badge: 'bg-rose-500 text-white font-black',
          icon: AlertTriangle,
          label: '🚨 URGENT ALERT'
        };
      case 'warning':
        return {
          bg: 'bg-amber-950/90 border-amber-500/60 text-amber-200',
          badge: 'bg-amber-400 text-black font-black',
          icon: AlertCircle,
          label: '⚠️ NOTICE'
        };
      case 'success':
        return {
          bg: 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200',
          badge: 'bg-emerald-500 text-white font-black',
          icon: Sparkles,
          label: '🎉 EVENT UPDATE'
        };
      case 'info':
      default:
        return {
          bg: 'bg-cyan-950/90 border-cyan-500/60 text-cyan-200',
          badge: 'bg-cyan-400 text-black font-black',
          icon: Megaphone,
          label: '📢 ANNOUNCEMENT'
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.icon;

  return (
    <div className={`w-full border-b backdrop-blur-md shadow-2xl transition-all duration-500 relative z-50 ${theme.bg}`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 overflow-hidden">
        <div className="flex items-center gap-3 overflow-hidden flex-1 relative">
          <span className={`text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full font-black flex items-center gap-1.5 shrink-0 z-10 shadow-lg ${theme.badge}`}>
            <IconComponent size={12} className="animate-pulse" />
            {theme.label}
          </span>
          <div className="overflow-hidden relative w-full flex items-center">
            <div className="animate-marquee flex items-center gap-16 whitespace-nowrap py-0.5">
              <span className="text-xs font-mono font-black tracking-wider">{broadcast.message}</span>
              <span className="text-xs font-mono font-black tracking-wider opacity-60">•</span>
              <span className="text-xs font-mono font-black tracking-wider">{broadcast.message}</span>
              <span className="text-xs font-mono font-black tracking-wider opacity-60">•</span>
              <span className="text-xs font-mono font-black tracking-wider">{broadcast.message}</span>
              <span className="text-xs font-mono font-black tracking-wider opacity-60">•</span>
              <span className="text-xs font-mono font-black tracking-wider">{broadcast.message}</span>
              <span className="text-xs font-mono font-black tracking-wider opacity-60">•</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissedId(broadcast.id)}
          className="p-1.5 rounded-lg hover:bg-white/10 text-current opacity-70 hover:opacity-100 transition-all shrink-0 z-10"
          title="Dismiss Announcement"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
