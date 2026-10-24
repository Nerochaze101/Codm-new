import React, { useState, useEffect } from 'react';
import {
  X, Bell, BellRing, BellOff, Swords, Zap, AlertTriangle,
  Trophy, Shield, Trash2, Check, ExternalLink, Sparkles, Smartphone, Send, CheckCircle2
} from 'lucide-react';
import { UserProfile } from '../types';
import {
  NotificationPayload,
  requestNotificationPermission,
  getNotificationPermission,
  showBrowserNotification,
  isIOS,
  isStandalone,
} from '../services/notificationService';
import { IOSNotificationGuideModal } from './IOSNotificationGuideModal';

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationPayload[];
  onClearNotifications: () => void;
  onNavigateToMatch?: (url?: string) => void;
  currentUser?: UserProfile;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onClearNotifications,
  onNavigateToMatch,
  currentUser,
}) => {
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [botUsername, setBotUsername] = useState('OpsSTAKEBOT');

  useEffect(() => {
    fetch('/api/telegram/bot-info')
      .then((r) => r.json())
      .then((d) => {
        if (d.botUsername) setBotUsername(d.botUsername);
      })
      .catch(() => {});
  }, []);

  if (!isOpen) return null;

  const permission = getNotificationPermission();
  const onIOS = isIOS();
  const inStandalone = isStandalone();

  const handleRequestPermission = async () => {
    if (onIOS && !inStandalone) {
      setShowIOSGuide(true);
      return;
    }
    await requestNotificationPermission();
  };

  const handleTestAlert = async () => {
    await showBrowserNotification({
      title: '⚔️ Test Mobile Alert: Rival Joined!',
      body: 'Your phone notification and tactical sound alerts are working perfectly!',
      soundType: 'rival_joined',
      data: { url: '/arena' },
    });
  };

  const getAlertIcon = (type?: string) => {
    switch (type) {
      case 'rival_joined':
        return <Swords className="w-4 h-4 text-amber-400" />;
      case 'match_started':
        return <Zap className="w-4 h-4 text-emerald-400" />;
      case 'disputed':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      case 'settled':
        return <Trophy className="w-4 h-4 text-yellow-400" />;
      default:
        return <Bell className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold font-heading text-white">Live Match Alerts</h3>
              <p className="text-xs text-neutral-400">Real-time mobile & browser notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Permission Banner & Device Status */}
        <div className="p-4 bg-neutral-950/80 border-b border-neutral-800">
          <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  permission === 'granted'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {permission === 'granted' ? <BellRing size={18} /> : <BellOff size={18} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">Phone Notifications</span>
                  <span
                    className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                      permission === 'granted'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {permission === 'granted' ? 'Active' : 'Permission Needed'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  {permission === 'granted'
                    ? 'Lock screen and sound alerts active for match events.'
                    : onIOS && !inStandalone
                    ? 'iPhone requires adding app to Home Screen for lock-screen alerts.'
                    : 'Enable to get notified on lock screen when rivals join or match starts.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {permission !== 'granted' ? (
                <button
                  onClick={handleRequestPermission}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase rounded-xl transition-all shadow cursor-pointer active:scale-95 flex items-center gap-1.5"
                >
                  {onIOS && !inStandalone && <Smartphone size={13} />}
                  <span>{onIOS && !inStandalone ? 'iPhone: Setup Alerts' : 'Enable Alerts'}</span>
                </button>
              ) : (
                <button
                  onClick={handleTestAlert}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles size={13} className="text-amber-400" />
                  <span>Test Alert</span>
                </button>
              )}
            </div>
          </div>

          {/* Telegram Bot Direct Comms Integration */}
          {currentUser && currentUser.id !== 'guest' && (
            <div className="mt-2.5 p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    currentUser.telegramChatId
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                      : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                  }`}
                >
                  <Send size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Telegram Battle Comms</span>
                    <span
                      className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                        currentUser.telegramChatId
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                      }`}
                    >
                      {currentUser.telegramChatId ? 'SYNCED' : '1-TAP LINK'}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    {currentUser.telegramChatId
                      ? `Connected to @${botUsername} (Chat ID: ${currentUser.telegramChatId}). Instant alerts active.`
                      : 'Never miss a challenge! Receive instant Telegram messages when rivals join or funds pay out.'}
                  </p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {currentUser.telegramChatId ? (
                  <a
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-300 font-semibold text-xs rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>Open Bot</span>
                  </a>
                ) : (
                  <a
                    href={`https://t.me/${botUsername}?start=link_${currentUser.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-gradient-to-r from-sky-400 to-blue-500 hover:from-sky-300 hover:to-blue-400 text-neutral-950 font-black text-xs uppercase rounded-xl transition-all shadow-md shadow-sky-500/20 cursor-pointer active:scale-95 flex items-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>Link Bot in 1-Tap</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-neutral-800/60 border border-neutral-700/50 flex items-center justify-center text-neutral-500 mx-auto">
                <Bell size={22} />
              </div>
              <p className="text-sm font-semibold text-neutral-300">No match alerts yet</p>
              <p className="text-xs text-neutral-500 max-w-xs mx-auto">
                When a rival joins your challenge, stakes are locked, or a match room starts, alerts will appear here in real time.
              </p>
            </div>
          ) : (
            notifications.map((notif, idx) => (
              <div
                key={notif.id || `notif_${idx}`}
                className="p-3.5 rounded-2xl bg-neutral-950/70 border border-neutral-800/80 hover:border-neutral-700 transition-all flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center shrink-0 mt-0.5">
                    {getAlertIcon(notif.soundType)}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">{notif.title}</h5>
                    <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{notif.body}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onNavigateToMatch?.(notif.data?.url || '/arena');
                    onClose();
                  }}
                  className="p-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                  title="View Match in Arena"
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {notifications.length > 0 && (
          <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-mono">
              {notifications.length} recent {notifications.length === 1 ? 'alert' : 'alerts'}
            </span>
            <button
              onClick={onClearNotifications}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 size={13} />
              <span>Clear History</span>
            </button>
          </div>
        )}
      </div>

      {/* iPhone PWA Installation Guide Modal */}
      <IOSNotificationGuideModal isOpen={showIOSGuide} onClose={() => setShowIOSGuide(false)} />
    </div>
  );
};
