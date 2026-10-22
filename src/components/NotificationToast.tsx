import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Swords, Zap, AlertTriangle, Trophy, Shield, Bell } from 'lucide-react';
import { NotificationPayload } from '../services/notificationService';

interface NotificationToastProps {
  notification: NotificationPayload | null;
  onClose: () => void;
  onAction?: (url?: string) => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onClose,
  onAction,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!notification) {
      setProgress(100);
      return;
    }

    setProgress(100);
    const duration = 6500; // 6.5s
    const intervalTime = 50;
    const step = (intervalTime / duration) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= step) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [notification, onClose]);

  if (!notification) return null;

  const getIcon = () => {
    switch (notification.soundType) {
      case 'rival_joined':
        return <Swords className="w-5 h-5 text-amber-400 animate-pulse" />;
      case 'match_started':
        return <Zap className="w-5 h-5 text-emerald-400 animate-bounce" />;
      case 'disputed':
        return <AlertTriangle className="w-5 h-5 text-rose-400 animate-pulse" />;
      case 'settled':
        return <Trophy className="w-5 h-5 text-yellow-400" />;
      default:
        return <Bell className="w-5 h-5 text-amber-400" />;
    }
  };

  const getBorderColor = () => {
    switch (notification.soundType) {
      case 'rival_joined':
        return 'border-amber-500/50 shadow-amber-500/20';
      case 'match_started':
        return 'border-emerald-500/50 shadow-emerald-500/20';
      case 'disputed':
        return 'border-rose-500/50 shadow-rose-500/20';
      case 'settled':
        return 'border-yellow-500/50 shadow-yellow-500/20';
      default:
        return 'border-neutral-700 shadow-neutral-900/50';
    }
  };

  const getProgressColor = () => {
    switch (notification.soundType) {
      case 'rival_joined':
        return 'bg-amber-400';
      case 'match_started':
        return 'bg-emerald-400';
      case 'disputed':
        return 'bg-rose-400';
      case 'settled':
        return 'bg-yellow-400';
      default:
        return 'bg-neutral-400';
    }
  };

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-top-4 fade-in duration-300">
      <div
        className={`bg-neutral-900/95 backdrop-blur-xl border rounded-2xl p-4 shadow-2xl relative overflow-hidden ${getBorderColor()}`}
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-800/80 border border-neutral-700/50 flex items-center justify-center shrink-0">
            {getIcon()}
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                Live Alert
              </span>
              <span className="text-[11px] text-neutral-400 font-mono">Just now</span>
            </div>
            <h4 className="text-sm font-bold font-heading text-white mt-1 truncate">
              {notification.title}
            </h4>
            <p className="text-xs text-neutral-300 mt-0.5 line-clamp-2 leading-relaxed">
              {notification.body}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => {
                  onAction?.(notification.data?.url || '/arena');
                  onClose();
                }}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wide rounded-lg flex items-center gap-1.5 transition-transform active:scale-95 shadow cursor-pointer"
              >
                <span>Enter Arena</span>
                <ExternalLink size={12} />
              </button>
              <button
                onClick={onClose}
                className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
            title="Close Alert"
          >
            <X size={16} />
          </button>
        </div>

        {/* Progress timer bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-neutral-800">
          <div
            className={`h-full transition-all duration-75 ease-linear ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};
