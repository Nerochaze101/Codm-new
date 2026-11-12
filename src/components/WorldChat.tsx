import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Send, Swords, Users, UserPlus, MessageCircle, Trash2,
  Radio, X, Share2, Check, Loader2, ArrowDown, Flame, Shield
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { UserProfile, Match, WorldChatMessage } from '../types';
import {
  fetchWorldChatMessages,
  postWorldChatMessage,
  deleteWorldChatMessage,
  sendFriendRequest,
} from '../services/api';

interface WorldChatProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  myHostedBets: Match[];
  openChallenges: Match[];
  onAcceptChallenge: (match: Match) => void;
  onChallengePlayer: (playerId: string) => void;
  onNavigateToSocial?: () => void;
}

const QUICK_CALLOUTS = [
  { label: '1v1 Sniper?', text: 'Anyone ready for 1v1 Sniper Only? Drop wager or invite me!', channel: 'wagers' as const },
  { label: 'Need Squad', text: 'Looking for squad teammates for 5v5 S&D / Hardpoint!', channel: 'lfg' as const },
  { label: 'Drop Code', text: 'Drop your open #CHALLENGE code, looking to stake right now!', channel: 'wagers' as const },
  { label: 'GGs!', text: 'GGs operators! Who wants next?', channel: 'global' as const },
];

const CHANNELS = [
  { id: 'all', label: 'World', shortLabel: 'World', icon: Globe },
  { id: 'global', label: 'Global', shortLabel: 'Global', icon: Radio },
  { id: 'wagers', label: '1v1 Wagers', shortLabel: '1v1', icon: Swords },
  { id: 'lfg', label: 'Squad LFG', shortLabel: 'Squad', icon: Users },
] as const;

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTierShortLabel(tier?: string, role?: string): { text: string; cls: string } {
  if (role === 'admin' || role === 'super_admin') {
    return { text: 'CMD', cls: 'bg-rose-500/20 text-rose-400 border-rose-500/40' };
  }
  if (role === 'moderator') {
    return { text: 'MOD', cls: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
  }
  const upper = (tier || 'ROOKIE').toUpperCase();
  if (upper.includes('LEGENDARY')) return { text: 'LEG', cls: 'bg-amber-400/20 text-amber-300 border-amber-400/40' };
  if (upper.includes('GRANDMASTER')) return { text: 'GM', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
  if (upper.includes('MASTER')) return { text: 'MST', cls: 'bg-purple-500/20 text-purple-300 border-purple-500/40' };
  if (upper.includes('PRO')) return { text: 'PRO', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
  if (upper.includes('ELITE')) return { text: 'ELT', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/40' };
  if (upper.includes('VETERAN')) return { text: 'VET', cls: 'bg-neutral-700/70 text-neutral-200 border-neutral-600' };
  return { text: 'RKE', cls: 'bg-neutral-800/90 text-neutral-400 border-neutral-700/80' };
}

export const WorldChat: React.FC<WorldChatProps> = ({
  isOpen,
  onClose,
  currentUser,
  myHostedBets,
  openChallenges,
  onAcceptChallenge,
  onChallengePlayer,
  onNavigateToSocial,
}) => {
  const [messages, setMessages] = useState<WorldChatMessage[]>([]);
  const [activeChannel, setActiveChannel] = useState<'all' | 'global' | 'wagers' | 'lfg'>('all');
  const [postChannel, setPostChannel] = useState<'global' | 'wagers' | 'lfg'>('global');
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineCount, setOnlineCount] = useState<number>(1);
  const [selectedOperator, setSelectedOperator] = useState<WorldChatMessage | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [addedRivalIds, setAddedRivalIds] = useState<Record<string, boolean>>({});
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const socketRef = useRef<Socket | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const sendingLockRef = useRef(false);
  const lastQuickCalloutAtRef = useRef(0);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isGuest = !currentUser?.id || currentUser.id === 'guest';
  const isAdminOrMod = ['admin', 'super_admin', 'moderator'].includes(currentUser?.role || '');

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusFeedback({ type, text });
    setTimeout(() => setStatusFeedback(null), 3500);
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const loadMessages = async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchWorldChatMessages('all');
      setMessages((prev) => {
        const byId = new Map<string, WorldChatMessage>();
        for (const m of prev) {
          if (Date.now() - m.timestamp < 10000) byId.set(m.id, m);
        }
        for (const m of data.messages) {
          byId.set(m.id, m);
        }
        const merged = Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp).slice(-200);
        if (merged.length === prev.length && merged.every((m, idx) => m.id === prev[idx].id)) {
          return prev;
        }
        return merged;
      });
      if (data.onlineCount > 0) setOnlineCount(data.onlineCount);
    } catch (err) {
      console.warn('Failed to fetch world chat history:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    const s = io('/', {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;

    const onConnect = () => {
      setIsConnected(true);
      s.emit('join_world_chat');
      loadMessages(true);
    };

    if (s.connected) {
      onConnect();
    }

    s.on('connect', onConnect);
    s.on('disconnect', () => setIsConnected(false));

    s.on('world_chat_online', (data: { onlineCount?: number }) => {
      if (data?.onlineCount) setOnlineCount(data.onlineCount);
    });

    s.on('world_chat_message', (incoming: WorldChatMessage) => {
      if (!incoming || !incoming.id) return;
      if (incoming.senderId) {
        setTypingUsers((prev) => {
          if (!prev[incoming.senderId]) return prev;
          const next = { ...prev };
          delete next[incoming.senderId];
          return next;
        });
      }
      setMessages((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [...prev, incoming].slice(-200);
      });
    });

    s.on('world_typing', (data: { userId?: string; senderIgn?: string; isTyping?: boolean }) => {
      if (!data?.userId || data.userId === currentUser?.id) return;
      const uid = data.userId;
      if (typingTimeoutsRef.current[uid]) {
        clearTimeout(typingTimeoutsRef.current[uid]);
      }
      if (data.isTyping) {
        setTypingUsers((prev) => ({ ...prev, [uid]: data.senderIgn || 'Operator' }));
        typingTimeoutsRef.current[uid] = setTimeout(() => {
          setTypingUsers((prev) => {
            if (!prev[uid]) return prev;
            const next = { ...prev };
            delete next[uid];
            return next;
          });
        }, 4000);
      } else {
        setTypingUsers((prev) => {
          if (!prev[uid]) return prev;
          const next = { ...prev };
          delete next[uid];
          return next;
        });
      }
    });

    s.on('world_chat_deleted', (data: { id?: string }) => {
      if (data?.id) {
        setMessages((prev) => prev.filter((m) => m.id !== data.id));
      }
    });

    return () => {
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      s.disconnect();
    };
  }, [currentUser?.id]);

  // Escape key closes drawer cleanly
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  // Snap to bottom when opening drawer or switching channels
  useEffect(() => {
    if (isOpen) {
      isNearBottomRef.current = true;
      setShowScrollBottom(false);
      setTimeout(() => scrollToBottom(false), 40);
    }
  }, [isOpen, activeChannel]);

  useEffect(() => {
    if (isOpen && isNearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [messages.length, isOpen]);

  const handleFeedScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const nearBottom = distanceFromBottom <= 100;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
  };

  const handleChannelSelect = (chan: 'all' | 'global' | 'wagers' | 'lfg') => {
    setActiveChannel(chan);
    if (chan !== 'all') {
      setPostChannel(chan);
    }
  };

  const dispatchMessage = async (
    textToSend: string,
    channelOverride?: 'global' | 'wagers' | 'lfg',
    matchData?: { matchId: string; challengeCode: string; stakeAmount: number; gameMode: string },
    isQuickCallout = false
  ) => {
    if (isGuest) {
      showToast('error', 'Sign in to transmit in World Chat.');
      return;
    }
    const cleanText = textToSend.trim();
    if (!cleanText || sendingLockRef.current) return;

    if (isQuickCallout) {
      const now = Date.now();
      if (now - lastQuickCalloutAtRef.current < 1500) {
        return;
      }
      lastQuickCalloutAtRef.current = now;
    }

    sendingLockRef.current = true;
    setIsSending(true);
    const channelToUse = channelOverride || (activeChannel === 'all' ? postChannel : activeChannel);
    const msgId = `wc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = Date.now();

    const newMsg: WorldChatMessage = {
      id: msgId,
      senderId: currentUser.id,
      senderName: currentUser.username,
      senderIgn: currentUser.codmIgn || currentUser.username,
      senderAvatar: currentUser.avatar,
      senderTier: currentUser.tier || 'ROOKIE',
      senderClan: currentUser.clan,
      senderRole: currentUser.role || 'user',
      channel: channelToUse,
      text: cleanText,
      matchId: matchData?.matchId,
      challengeCode: matchData?.challengeCode,
      stakeAmount: matchData?.stakeAmount,
      gameMode: matchData?.gameMode,
      timestamp,
    };

    isNearBottomRef.current = true;
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg].slice(-200);
    });
    if (!isQuickCallout && !matchData) {
      setInputText('');
    }
    setShowScrollBottom(false);

    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    socketRef.current?.emit('world_typing', {
      userId: currentUser.id,
      senderIgn: currentUser.codmIgn || currentUser.username,
      isTyping: false,
    });

    try {
      await postWorldChatMessage(newMsg);
    } catch (err: any) {
      console.warn('World chat REST dispatch warning:', err);
      showToast('error', err.message || 'Failed to sync message.');
    } finally {
      sendingLockRef.current = false;
      setIsSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchMessage(inputText);
  };

  const handleShareHostedMatch = async (match: Match) => {
    setShowShareModal(false);
    const isSquad = match.matchType === 'squad' || Boolean(match.squadData);
    const summaryText = `OPEN ${isSquad ? '5v5 SQUAD' : '1v1'} WAGER: ₦${match.stakeAmount.toLocaleString()} on ${match.gameMode} (${match.map}) · #${match.challengeCode}`;
    await dispatchMessage(summaryText, 'wagers', {
      matchId: match.id,
      challengeCode: match.challengeCode,
      stakeAmount: match.stakeAmount,
      gameMode: `${match.gameMode} · ${match.map}`,
    });
  };

  const handleAddRival = async (targetUserId: string, targetIgn: string) => {
    if (isGuest) {
      showToast('error', 'Sign in to add rivals.');
      return;
    }
    try {
      await sendFriendRequest(currentUser.id, targetUserId);
      setAddedRivalIds((prev) => ({ ...prev, [targetUserId]: true }));
      showToast('success', `Rival request transmitted to ${targetIgn}`);
      setSelectedOperator(null);
    } catch (err: any) {
      showToast('error', err.message || 'Could not send rival request.');
    }
  };

  const handleDeleteMsg = async (msgId: string) => {
    try {
      await deleteWorldChatMessage(msgId, currentUser.id);
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
    } catch (err: any) {
      showToast('error', err.message || 'Failed to remove message.');
    }
  };

  const visibleMessages = activeChannel === 'all'
    ? messages
    : messages.filter((m) => m.channel === activeChannel);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-start sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* CoD Mobile Tactical World Chat Slide-Over Drawer */}
      <div className="w-full sm:max-w-3xl h-full sm:h-[85vh] sm:max-h-[760px] bg-[#090d12]/98 border-r sm:border border-neutral-800 sm:rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col relative">
        {/* Top Tactical Bar */}
        <div className="px-3.5 sm:px-4 py-2.5 bg-gradient-to-r from-[#0e151d] via-[#121a24] to-[#0d131a] border-b border-neutral-800/90 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 relative">
              <Globe size={15} />
              <span className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-neutral-950 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`} />
            </div>
            <div className="min-w-0 flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-black font-heading text-white uppercase tracking-wider truncate">
                World Chat
              </h2>
              <span className="text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {onlineCount} Online
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700/80 text-neutral-300 hover:text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-colors"
            title="Return to Arena"
          >
            <X size={13} />
            <span className="hidden sm:inline">Close</span>
          </button>
        </div>

        {/* Inline Status Toast */}
        {statusFeedback && (
          <div className={`mx-3 mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-between border ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}>
            <span>{statusFeedback.text}</span>
            <button onClick={() => setStatusFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              <X size={12} />
            </button>
          </div>
        )}

        {/* Body: CoD Mobile Side Channel Rail + High-Density Chat Stream */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row">
          {/* Channel Rail (Top bar on mobile, vertical rail on desktop like CoD Mobile) */}
          <div className="flex sm:flex-col gap-1 p-1.5 sm:p-2 bg-[#070a0e] border-b sm:border-b-0 sm:border-r border-neutral-800/80 sm:w-28 shrink-0 overflow-x-auto no-scrollbar">
            {CHANNELS.map((chan) => {
              const Icon = chan.icon;
              const isActive = activeChannel === chan.id;
              return (
                <button
                  key={chan.id}
                  type="button"
                  onClick={() => handleChannelSelect(chan.id)}
                  className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-2.5 py-2 sm:py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 border-l-2 ${
                    isActive
                      ? 'bg-amber-400/15 text-amber-400 border-amber-400 shadow-inner'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-900/80 border-transparent'
                  }`}
                >
                  <Icon size={13} className="shrink-0" />
                  <span className="truncate">{chan.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* Stream + Composer Column */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
            {/* Compact Chat Stream */}
            <div
              ref={feedRef}
              onScroll={handleFeedScroll}
              className="flex-1 overflow-y-auto divide-y divide-white/[0.04] bg-[#080c10]"
            >
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-2 p-6">
                  <Loader2 size={20} className="animate-spin text-amber-400" />
                  <span className="text-[11px] font-mono uppercase tracking-widest">Connecting Comms...</span>
                </div>
              ) : visibleMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-4 py-10 space-y-2">
                  <Globe size={24} className="text-neutral-600" />
                  <div className="text-xs font-black uppercase tracking-wider text-neutral-300">
                    Channel Quiet
                  </div>
                  <p className="text-[11px] text-neutral-500 max-w-xs">
                    Drop a quick callout below or post an open wager invite.
                  </p>
                </div>
              ) : (
                visibleMessages.map((msg) => {
                  const isOwn = msg.senderId === currentUser.id;
                  const tierBadge = getTierShortLabel(msg.senderTier, msg.senderRole);
                  const linkedMatch = msg.matchId
                    ? openChallenges.find((m) => m.id === msg.matchId || m.challengeCode === msg.challengeCode)
                    : undefined;

                  return (
                    <div
                      key={msg.id}
                      className={`group px-3 py-2 transition-colors ${
                        isOwn
                          ? 'bg-amber-400/[0.04] hover:bg-amber-400/[0.07]'
                          : 'hover:bg-white/[0.025]'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {/* Compact 24px Avatar */}
                        <button
                          type="button"
                          onClick={() => !isOwn && setSelectedOperator(msg)}
                          className={`shrink-0 mt-0.5 ${isOwn ? 'cursor-default' : 'cursor-pointer hover:opacity-85'}`}
                          title={isOwn ? 'You' : `Inspect ${msg.senderIgn}`}
                        >
                          {msg.senderAvatar ? (
                            <img
                              src={msg.senderAvatar}
                              alt={msg.senderIgn}
                              className="w-6 h-6 rounded-md object-cover border border-neutral-700/80 bg-neutral-900"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-md bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400 font-black text-[9px]">
                              {(msg.senderIgn || msg.senderName || '?').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </button>

                        {/* CoD Style Inline Row */}
                        <div className="flex-1 min-w-0 text-xs leading-snug">
                          <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
                            {activeChannel === 'all' && msg.channel !== 'global' && (
                              <span className={`text-[9px] font-black uppercase px-1 py-0 rounded border ${
                                msg.channel === 'wagers'
                                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              }`}>
                                {msg.channel === 'wagers' ? '1V1' : 'LFG'}
                              </span>
                            )}

                            <span className={`text-[9px] font-mono font-bold uppercase px-1 py-0 rounded border ${tierBadge.cls}`}>
                              {tierBadge.text}
                            </span>

                            {msg.senderClan && (
                              <span className="text-[10px] font-mono text-neutral-500 font-bold">
                                [{msg.senderClan}]
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => !isOwn && setSelectedOperator(msg)}
                              className={`font-black tracking-wide shrink-0 ${
                                isOwn
                                  ? 'text-amber-400 cursor-default'
                                  : 'text-sky-300 hover:text-amber-300 cursor-pointer hover:underline'
                              }`}
                            >
                              {msg.senderIgn || msg.senderName}
                            </button>
                            <span className="text-neutral-500 font-bold">:</span>

                            <span className="text-neutral-200 break-words">
                              {msg.text}
                            </span>
                          </div>

                          {/* Compact Inline Wager Invite Strip */}
                          {msg.matchId && msg.stakeAmount && (
                            <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d141c] border border-amber-500/30 flex items-center justify-between gap-2 max-w-md">
                              <div className="flex items-center gap-2 min-w-0">
                                <Flame size={13} className="text-amber-400 shrink-0" />
                                <span className="text-[11px] font-black text-white truncate">
                                  #{msg.challengeCode} · ₦{msg.stakeAmount.toLocaleString()}
                                </span>
                                <span className="text-[10px] text-neutral-400 truncate hidden sm:inline">
                                  {msg.gameMode}
                                </span>
                              </div>
                              {!isOwn && (
                                linkedMatch ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      onAcceptChallenge(linkedMatch);
                                    }}
                                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase tracking-wider rounded cursor-pointer flex items-center gap-1 shrink-0"
                                  >
                                    <Swords size={11} />
                                    Accept
                                  </button>
                                ) : (
                                  <span className="text-[9px] font-mono uppercase text-neutral-500 shrink-0">
                                    Closed
                                  </span>
                                )
                              )}
                            </div>
                          )}
                        </div>

                        {/* Time + Optional Delete */}
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          <span className="text-[9px] font-mono text-neutral-600">
                            {formatTime(msg.timestamp)}
                          </span>
                          {(isOwn || isAdminOrMod) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMsg(msg.id)}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-600 hover:text-rose-400 transition-opacity cursor-pointer"
                              title="Delete message"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to Bottom Floating Pill */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={() => {
                  isNearBottomRef.current = true;
                  setShowScrollBottom(false);
                  scrollToBottom(true);
                }}
                className="absolute bottom-32 right-4 z-20 px-2.5 py-1 rounded-full bg-amber-400 text-neutral-950 font-black text-[10px] uppercase tracking-wider shadow-xl flex items-center gap-1 cursor-pointer hover:bg-amber-300"
              >
                <ArrowDown size={11} />
                Latest
              </button>
            )}

            {/* Compact Operator Inspection Bar (when clicking any player IGN) */}
            {selectedOperator && (
              <div className="mx-2.5 mb-2 p-2.5 rounded-xl bg-[#101822] border border-amber-400/50 shadow-2xl flex flex-wrap items-center justify-between gap-2 animate-in fade-in duration-100">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black text-[10px] shrink-0">
                    {(selectedOperator.senderIgn || '?').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-white truncate">
                      {selectedOperator.senderIgn}
                    </div>
                    <div className="text-[10px] font-mono text-neutral-400 flex items-center gap-1">
                      <Shield size={9} className="text-amber-400" />
                      {selectedOperator.senderTier || 'ROOKIE'} {selectedOperator.senderClan ? `· ${selectedOperator.senderClan}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = selectedOperator.senderId;
                      setSelectedOperator(null);
                      onClose();
                      onChallengePlayer(targetId);
                    }}
                    className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase tracking-wider rounded-md flex items-center gap-1 cursor-pointer"
                  >
                    <Swords size={11} />
                    1v1 Duel
                  </button>

                  <button
                    type="button"
                    disabled={Boolean(addedRivalIds[selectedOperator.senderId])}
                    onClick={() => handleAddRival(selectedOperator.senderId, selectedOperator.senderIgn)}
                    className={`px-2.5 py-1 font-black text-[10px] uppercase tracking-wider rounded-md flex items-center gap-1 cursor-pointer border ${
                      addedRivalIds[selectedOperator.senderId]
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
                    }`}
                  >
                    {addedRivalIds[selectedOperator.senderId] ? <Check size={11} /> : <UserPlus size={11} />}
                    {addedRivalIds[selectedOperator.senderId] ? 'Sent' : 'Add Rival'}
                  </button>

                  {onNavigateToSocial && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOperator(null);
                        onClose();
                        onNavigateToSocial();
                      }}
                      className="px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-[10px] uppercase tracking-wider rounded-md flex items-center gap-1 border border-neutral-700 cursor-pointer"
                    >
                      <MessageCircle size={11} />
                      Social
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedOperator(null)}
                    className="p-1 text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Drop Open Match Selector */}
            {showShareModal && myHostedBets.length > 0 && (
              <div className="mx-2.5 mb-2 p-2.5 rounded-xl bg-[#0e161d] border border-emerald-500/40 space-y-1.5 animate-in fade-in duration-100">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Share2 size={11} />
                    Drop Open Wager to World Chat
                  </span>
                  <button onClick={() => setShowShareModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                  {myHostedBets.map((bet) => (
                    <button
                      key={bet.id}
                      type="button"
                      onClick={() => handleShareHostedMatch(bet)}
                      className="p-2 rounded-lg bg-black/70 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400/50 text-left flex items-center justify-between gap-2 transition-all cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="text-[11px] font-black text-amber-400 truncate">#{bet.challengeCode} · ₦{bet.stakeAmount.toLocaleString()}</div>
                        <div className="text-[10px] text-neutral-400 truncate">{bet.gameMode} · {bet.map}</div>
                      </div>
                      <span className="text-[9px] font-black uppercase bg-amber-400 text-neutral-950 px-2 py-0.5 rounded shrink-0">
                        Post
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Callouts + Typing Indicator + Input Bar */}
            <div className="px-2.5 sm:px-3 py-2.5 bg-[#0a0e14] border-t border-neutral-800/90 space-y-2 shrink-0">
              {/* Quick Callouts */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {myHostedBets.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowShareModal((v) => !v)}
                    className="px-2 py-1 rounded bg-amber-400/15 hover:bg-amber-400/25 text-amber-400 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Share2 size={10} />
                    Drop Wager ({myHostedBets.length})
                  </button>
                )}
                {QUICK_CALLOUTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    disabled={isSending}
                    onClick={() => dispatchMessage(q.text, q.channel, undefined, true)}
                    className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-neutral-300 hover:text-white border border-neutral-800 text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-pointer transition-colors"
                  >
                    {q.label}
                  </button>
                ))}
              </div>

              {/* Typing Indicator */}
              {Object.values(typingUsers).length > 0 && (
                <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 px-0.5">
                  <span className="flex items-center gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
                  </span>
                  <span>
                    {Object.values(typingUsers).slice(0, 2).join(', ')}
                    {Object.values(typingUsers).length > 2 ? ` +${Object.values(typingUsers).length - 2}` : ''}{' '}
                    {Object.values(typingUsers).length === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              )}

              {/* Input Form */}
              <form onSubmit={handleSend} className="flex items-center gap-1.5">
                {activeChannel === 'all' && (
                  <select
                    value={postChannel}
                    onChange={(e) => setPostChannel(e.target.value as 'global' | 'wagers' | 'lfg')}
                    className="bg-neutral-900 border border-neutral-800 text-[10px] font-black uppercase text-amber-400 rounded-lg px-2 py-2.5 focus:outline-none focus:border-amber-400 shrink-0 cursor-pointer"
                    title="Target Channel"
                  >
                    <option value="global">Global</option>
                    <option value="wagers">1v1</option>
                    <option value="lfg">Squad</option>
                  </select>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputText(val);
                    if (!isGuest && socketRef.current?.connected) {
                      socketRef.current.emit('world_typing', {
                        userId: currentUser.id,
                        senderIgn: currentUser.codmIgn || currentUser.username,
                        isTyping: val.trim().length > 0,
                      });
                      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
                      if (val.trim().length > 0) {
                        myTypingTimeoutRef.current = setTimeout(() => {
                          socketRef.current?.emit('world_typing', {
                            userId: currentUser.id,
                            senderIgn: currentUser.codmIgn || currentUser.username,
                            isTyping: false,
                          });
                        }, 2000);
                      }
                    }
                  }}
                  maxLength={400}
                  disabled={isGuest}
                  placeholder={
                    isGuest
                      ? 'Sign in to chat in World Chat...'
                      : 'Enter message to transmit...'
                  }
                  className="flex-1 min-w-0 bg-neutral-900 border border-neutral-800 focus:border-amber-400 text-xs text-white px-3 py-2.5 rounded-lg focus:outline-none placeholder:text-neutral-500 disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={isGuest || isSending || !inputText.trim()}
                  className="px-3.5 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
