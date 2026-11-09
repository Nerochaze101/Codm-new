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
  const [broadcasts, setBroadcasts] = useState<BroadcastData[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    // 1. Fetch active broadcasts from REST API
    const fetchActiveBroadcasts = async () => {
      try {
        const res = await fetch('/api/broadcast');
        const data = await res.json();
        if (data && Array.isArray(data.broadcasts)) {
          setBroadcasts(data.broadcasts);
        } else if (data && data.broadcast) {
          setBroadcasts([data.broadcast]);
        } else {
          setBroadcasts([]);
        }
      } catch (err) {
        console.error('Failed to fetch global broadcasts:', err);
      }
    };
    fetchActiveBroadcasts();

    // 2. Connect to Socket.IO for instant live updates
    const socket = io();
    socket.on('global_broadcasts', (payload: BroadcastData[]) => {
      if (Array.isArray(payload)) {
        setBroadcasts(payload.filter(b => b.active));
      }
    });

    socket.on('global_broadcast', (payload: BroadcastData | null) => {
      if (payload && payload.active) {
        setBroadcasts(prev => {
          const exists = prev.some(b => b.id === payload.id);
          if (exists) return prev.map(b => b.id === payload.id ? payload : b);
          return [payload, ...prev];
        });
      } else if (!payload) {
        setBroadcasts([]);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const activeBroadcasts = broadcasts.filter(b => b && b.message && b.active && !dismissedIds.includes(b.id));

  if (activeBroadcasts.length === 0) {
    return null;
  }

  // Determine highest priority theme for banner background container
  const hasUrgent = activeBroadcasts.some(b => b.type === 'urgent');
  const hasWarning = activeBroadcasts.some(b => b.type === 'warning');
  const hasSuccess = activeBroadcasts.some(b => b.type === 'success');

  const containerTheme = hasUrgent
    ? 'bg-rose-950/90 border-rose-500/60 text-rose-200'
    : hasWarning
    ? 'bg-amber-950/90 border-amber-500/60 text-amber-200'
    : hasSuccess
    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
    : 'bg-cyan-950/90 border-cyan-500/60 text-cyan-200';

  const getTagStyle = (type: string) => {
    switch (type) {
      case 'urgent':
        return { badge: 'bg-rose-500 text-white font-black', icon: AlertTriangle, label: '🚨 URGENT' };
      case 'warning':
        return { badge: 'bg-amber-400 text-black font-black', icon: AlertCircle, label: '⚠️ NOTICE' };
      case 'success':
        return { badge: 'bg-emerald-500 text-white font-black', icon: Sparkles, label: '🎉 EVENT' };
      case 'info':
      default:
        return { badge: 'bg-cyan-400 text-black font-black', icon: Megaphone, label: '📢 ANNOUNCEMENT' };
    }
  };

  const mainTag = getTagStyle(activeBroadcasts[0].type);
  const MainIcon = mainTag.icon;

  // Duplicate active broadcasts array to create seamless loop
  const loopItems = [...activeBroadcasts, ...activeBroadcasts, ...activeBroadcasts];

  return (
    <div className={`w-full border-b backdrop-blur-md shadow-2xl transition-all duration-500 relative z-50 ${containerTheme}`}>
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4 overflow-hidden">
        <div className="flex items-center gap-3 overflow-hidden flex-1 relative">
          <span className={`text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-full font-black flex items-center gap-1.5 shrink-0 z-10 shadow-lg ${mainTag.badge}`}>
            <MainIcon size={12} className="animate-pulse" />
            {activeBroadcasts.length > 1 ? `📢 ${activeBroadcasts.length} LIVE ALERTS` : mainTag.label}
          </span>
          <div className="overflow-hidden relative w-full flex items-center">
            <div className="animate-marquee flex items-center gap-12 whitespace-nowrap py-0.5">
              {loopItems.map((item, idx) => {
                const itemTag = getTagStyle(item.type);
                const ItemIcon = itemTag.icon;
                return (
                  <React.Fragment key={`${item.id}_${idx}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${itemTag.badge} shrink-0`}>
                        <ItemIcon size={10} className="inline mr-1" />
                        {itemTag.label}
                      </span>
                      <span className="text-xs font-mono font-black tracking-wider text-white">{item.message}</span>
                    </div>
                    <span className="text-xs font-mono font-black tracking-wider opacity-50 text-neutral-400">•</span>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissedIds(prev => [...prev, ...activeBroadcasts.map(b => b.id)])}
          className="p-1.5 rounded-lg hover:bg-white/10 text-current opacity-70 hover:opacity-100 transition-all shrink-0 z-10"
          title="Dismiss All Live Announcements"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
