import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Send, Swords, Users, UserPlus, MessageCircle, Trash2,
  Radio, X, Share2, Check, Loader2, ArrowDown, Flame, Shield, Lock
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
  allPendingMatches?: Match[];
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
  { id: 'all', label: 'World', icon: Globe },
  { id: 'global', label: 'Global', icon: Radio },
  { id: 'wagers', label: '1v1 Wagers', icon: Swords },
  { id: 'lfg', label: 'Squad LFG', icon: Users },
] as const;

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTierShortLabel(tier?: string, role?: string): { text: string; cls: string } {
  if (role === 'admin' || role === 'super_admin') {
    return { text: 'CMD', cls: 'text-rose-400' };
  }
  if (role === 'moderator') {
    return { text: 'MOD', cls: 'text-cyan-300' };
  }
  const upper = (tier || 'ROOKIE').toUpperCase();
  if (upper.includes('LEGENDARY')) return { text: 'LEG', cls: 'text-amber-300' };
  if (upper.includes('GRANDMASTER')) return { text: 'GM', cls: 'text-purple-300' };
  if (upper.includes('MASTER')) return { text: 'MST', cls: 'text-purple-300' };
  if (upper.includes('PRO')) return { text: 'PRO', cls: 'text-emerald-300' };
  if (upper.includes('ELITE')) return { text: 'ELT', cls: 'text-sky-300' };
  if (upper.includes('VETERAN')) return { text: 'VET', cls: 'text-neutral-300' };
  return { text: 'RKE', cls: 'text-neutral-400' };
}

export const WorldChat: React.FC<WorldChatProps> = ({
  isOpen,
  onClose,
  currentUser,
  myHostedBets,
  openChallenges,
  allPendingMatches,
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
  const searchableMatches = allPendingMatches && allPendingMatches.length > 0 ? allPendingMatches : openChallenges;

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
      setTimeout(() => scrollToBottom(false), 50);
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
      showToast('error', 'Sign in to send messages in World Chat.');
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
    const isPrivate = match.isPublic === false;
    const label = isPrivate
      ? `PRIVATE ${isSquad ? '5v5 SQUAD' : '1v1'} INVITE`
      : `OPEN ${isSquad ? '5v5 SQUAD' : '1v1'} WAGER`;
    const summaryText = `${label}: ₦${match.stakeAmount.toLocaleString()} on ${match.gameMode} (${match.map}) · #${match.challengeCode}`;
    await dispatchMessage(summaryText, 'wagers', {
      matchId: match.id,
      challengeCode: match.challengeCode,
      stakeAmount: match.stakeAmount,
      gameMode: `${match.gameMode} · ${match.map}`,
    });
    showToast('success', `Shared #${match.challengeCode} to World Chat.`);
  };

  const handleAddRival = async (targetUserId: string, targetIgn: string) => {
    if (isGuest) {
      showToast('error', 'Sign in to add rivals.');
      return;
    }
    try {
      await sendFriendRequest(currentUser.id, targetUserId);
      setAddedRivalIds((prev) => ({ ...prev, [targetUserId]: true }));
      showToast('success', `Rival request sent to ${targetIgn}`);
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
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Spacious World Chat Modal Container */}
      <div className="w-full sm:max-w-3xl lg:max-w-4xl h-[92dvh] sm:h-[84dvh] max-h-[820px] bg-[#0a0f14] border border-neutral-800 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col relative">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 bg-[#10161d] border-b border-neutral-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <Globe size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black font-heading text-white uppercase tracking-wide truncate">
                  World Chat
                </h2>
                <span className="text-xs font-mono text-neutral-400 tabular-nums shrink-0">
                  · {onlineCount} online {isConnected ? '' : '· reconnecting'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[36px] px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
            title="Close World Chat"
          >
            <X size={15} />
            <span>Close</span>
          </button>
        </div>

        {/* Clean Horizontal Channel Tabs */}
        <div className="px-4 py-2 bg-[#0c1218] border-b border-neutral-800/80 flex items-center justify-between gap-3 shrink-0 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-neutral-900/90 border border-neutral-800">
            {CHANNELS.map((chan) => {
              const Icon = chan.icon;
              const isActive = activeChannel === chan.id;
              return (
                <button
                  key={chan.id}
                  type="button"
                  onClick={() => handleChannelSelect(chan.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-amber-400 text-neutral-950 font-black shadow-sm'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/70'
                  }`}
                >
                  <Icon size={13} className="shrink-0" />
                  <span>{chan.label}</span>
                </button>
              );
            })}
          </div>

          {myHostedBets.length > 0 && (
            <button
              type="button"
              onClick={() => setShowShareModal((v) => !v)}
              className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 whitespace-nowrap"
            >
              <Share2 size={13} />
              <span>Share Hosted Bet ({myHostedBets.length})</span>
            </button>
          )}
        </div>

        {/* Inline Status Toast */}
        {statusFeedback && (
          <div className={`mx-4 mt-2.5 px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between border shrink-0 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}>
            <span>{statusFeedback.text}</span>
            <button onClick={() => setStatusFeedback(null)} className="opacity-70 hover:opacity-100 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Chat Stream */}
        <div
          ref={feedRef}
          onScroll={handleFeedScroll}
          className="flex-1 min-h-0 overflow-y-auto divide-y divide-white/[0.04] bg-[#080c10]"
        >
          {isLoading ? (
            <div className="h-full flex flex-col items-center justify-center text-neutral-400 gap-2 p-6">
              <Loader2 size={22} className="animate-spin text-amber-400" />
              <span className="text-xs font-mono">Loading World Chat...</span>
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12 space-y-2">
              <Globe size={28} className="text-neutral-600" />
              <div className="text-sm font-bold text-neutral-200">No messages in this channel yet</div>
              <p className="text-xs text-neutral-500 max-w-xs">
                Say hello below, tap a quick callout, or share one of your hosted bets.
              </p>
            </div>
          ) : (
            visibleMessages.map((msg) => {
              const isOwn = msg.senderId === currentUser.id;
              const tierBadge = getTierShortLabel(msg.senderTier, msg.senderRole);
              const linkedMatch = msg.matchId
                ? searchableMatches.find((m) => m.id === msg.matchId || m.challengeCode === msg.challengeCode)
                : undefined;
              const isPrivateShared = linkedMatch?.isPublic === false || msg.text.toUpperCase().includes('PRIVATE');

              return (
                <div
                  key={msg.id}
                  className={`group px-4 py-2.5 transition-colors ${
                    isOwn ? 'bg-amber-400/[0.04]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-start gap-2.5">
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
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-lg object-cover border border-neutral-800 bg-neutral-900"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400 font-black text-[10px]">
                          {(msg.senderIgn || msg.senderName || '?').substring(0, 2).toUpperCase()}
                        </div>
                      )}
                    </button>

                    <div className="flex-1 min-w-0 text-[13px] leading-relaxed">
                      <div className="flex items-baseline flex-wrap gap-x-1.5 gap-y-0.5">
                        <span className={`text-[10px] font-mono font-bold uppercase ${tierBadge.cls}`}>
                          [{tierBadge.text}]
                        </span>

                        {activeChannel === 'all' && msg.channel !== 'global' && (
                          <span className={`text-[10px] font-mono font-bold uppercase ${
                            msg.channel === 'wagers' ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {msg.channel === 'wagers' ? '1v1' : 'Squad'} ·
                          </span>
                        )}

                        {msg.senderClan && (
                          <span className="text-[11px] font-mono text-neutral-500">
                            {msg.senderClan}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => !isOwn && setSelectedOperator(msg)}
                          className={`font-bold tracking-wide shrink-0 ${
                            isOwn
                              ? 'text-amber-400 cursor-default'
                              : 'text-sky-300 hover:text-amber-300 cursor-pointer hover:underline'
                          }`}
                        >
                          {msg.senderIgn || msg.senderName}
                        </button>
                        <span className="text-neutral-500">:</span>
                        <span className="text-neutral-200 break-words">{msg.text}</span>
                      </div>

                      {/* Inline Wager Invite Strip (supports both Public and Private shared bets) */}
                      {msg.matchId && msg.stakeAmount && (
                        <div className="mt-2 px-3 py-2 rounded-xl bg-[#0e151d] border border-neutral-800 flex flex-wrap items-center justify-between gap-2 max-w-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            {isPrivateShared ? (
                              <Lock size={14} className="text-amber-400 shrink-0" />
                            ) : (
                              <Flame size={14} className="text-amber-400 shrink-0" />
                            )}
                            <span className="text-xs font-bold text-white truncate tabular-nums">
                              #{msg.challengeCode} · ₦{msg.stakeAmount.toLocaleString()}
                            </span>
                            <span className="text-[11px] text-neutral-400 truncate">
                              · {msg.gameMode}
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
                                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[11px] uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-1 shrink-0 whitespace-nowrap"
                              >
                                <Swords size={12} />
                                <span>Accept</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                                Closed
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <span className="text-[10px] font-mono text-neutral-500 tabular-nums">
                        {formatTime(msg.timestamp)}
                      </span>
                      {(isOwn || isAdminOrMod) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteMsg(msg.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-rose-400 transition-opacity cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 size={12} />
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

        {/* Scroll to Bottom Button */}
        {showScrollBottom && (
          <button
            type="button"
            onClick={() => {
              isNearBottomRef.current = true;
              setShowScrollBottom(false);
              scrollToBottom(true);
            }}
            className="absolute bottom-36 right-5 z-20 px-3 py-1.5 rounded-full bg-amber-400 text-neutral-950 font-black text-[11px] uppercase tracking-wider shadow-xl flex items-center gap-1 cursor-pointer hover:bg-amber-300"
          >
            <ArrowDown size={12} />
            Latest
          </button>
        )}

        {/* Selected Operator Inspection Bar */}
        {selectedOperator && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-[#101822] border border-amber-400/50 shadow-2xl flex flex-wrap items-center justify-between gap-2 shrink-0 animate-in fade-in duration-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black text-xs shrink-0">
                {(selectedOperator.senderIgn || '?').substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-white truncate">
                  {selectedOperator.senderIgn}
                </div>
                <div className="text-[11px] font-mono text-neutral-400 flex items-center gap-1">
                  <Shield size={10} className="text-amber-400" />
                  <span>{selectedOperator.senderTier || 'ROOKIE'}</span>
                  {selectedOperator.senderClan && <span>· {selectedOperator.senderClan}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const targetId = selectedOperator.senderId;
                  setSelectedOperator(null);
                  onClose();
                  onChallengePlayer(targetId);
                }}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase rounded-lg flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Swords size={12} />
                Challenge 1v1
              </button>

              <button
                type="button"
                disabled={Boolean(addedRivalIds[selectedOperator.senderId])}
                onClick={() => handleAddRival(selectedOperator.senderId, selectedOperator.senderIgn)}
                className={`px-3 py-1.5 font-bold text-xs uppercase rounded-lg flex items-center gap-1 cursor-pointer border whitespace-nowrap ${
                  addedRivalIds[selectedOperator.senderId]
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
                }`}
              >
                {addedRivalIds[selectedOperator.senderId] ? <Check size={12} /> : <UserPlus size={12} />}
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
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase rounded-lg flex items-center gap-1 border border-neutral-700 cursor-pointer whitespace-nowrap"
                >
                  <MessageCircle size={12} />
                  Social
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedOperator(null)}
                className="p-1.5 text-neutral-400 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Share Hosted Bet Picker (Public or Private) */}
        {showShareModal && myHostedBets.length > 0 && (
          <div className="mx-4 mb-2 p-3 rounded-xl bg-[#0e161d] border border-emerald-500/40 space-y-2 shrink-0 animate-in fade-in duration-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                <Share2 size={13} />
                Share Hosted Bet to World Chat (Public or Private)
              </span>
              <button onClick={() => setShowShareModal(false)} className="text-neutral-400 hover:text-white cursor-pointer">
                <X size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto">
              {myHostedBets.map((bet) => {
                const isPriv = bet.isPublic === false;
                return (
                  <button
                    key={bet.id}
                    type="button"
                    onClick={() => handleShareHostedMatch(bet)}
                    className="p-2.5 rounded-lg bg-black/70 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400/50 text-left flex items-center justify-between gap-2 transition-all cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-amber-400 truncate tabular-nums">
                        #{bet.challengeCode} · ₦{bet.stakeAmount.toLocaleString()} · {isPriv ? 'Private' : 'Public'}
                      </div>
                      <div className="text-[11px] text-neutral-400 truncate">{bet.gameMode} · {bet.map}</div>
                    </div>
                    <span className="text-[11px] font-black uppercase bg-amber-400 text-neutral-950 px-2.5 py-1 rounded shrink-0">
                      Share
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Composer */}
        <div className="px-4 py-3 bg-[#0c1218] border-t border-neutral-800 space-y-2.5 shrink-0">
          {/* Quick Callouts & Optional Channel Target */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 shrink-0">
              {QUICK_CALLOUTS.map((q) => (
                <button
                  key={q.label}
                  type="button"
                  disabled={isSending}
                  onClick={() => dispatchMessage(q.text, q.channel, undefined, true)}
                  className="px-2.5 py-1 rounded-md bg-neutral-900 hover:bg-neutral-800 disabled:opacity-50 text-neutral-300 hover:text-white border border-neutral-800 text-[11px] font-medium shrink-0 cursor-pointer transition-colors whitespace-nowrap"
                >
                  {q.label}
                </button>
              ))}
            </div>

            {activeChannel === 'all' && (
              <div className="flex items-center gap-1 text-[11px] text-neutral-400 shrink-0">
                <span>Post to:</span>
                {(['global', 'wagers', 'lfg'] as const).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => setPostChannel(ch)}
                    className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors whitespace-nowrap ${
                      postChannel === ch
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {ch === 'global' ? 'Global' : ch === 'wagers' ? '1v1' : 'Squad'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Typing Indicator */}
          {Object.values(typingUsers).length > 0 && (
            <div className="text-[11px] font-mono text-emerald-400">
              {Object.values(typingUsers).slice(0, 2).join(', ')}
              {Object.values(typingUsers).length > 2 ? ` +${Object.values(typingUsers).length - 2} others` : ''}{' '}
              {Object.values(typingUsers).length === 1 ? 'is' : 'are'} typing...
            </div>
          )}

          {/* Spacious Input + Always-Visible Send Button */}
          <form onSubmit={handleSend} className="flex items-center gap-2.5 w-full">
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
                  : 'Write a message to World Chat...'
              }
              className="flex-1 min-w-0 h-11 bg-neutral-900 border border-neutral-800 focus:border-amber-400 text-sm text-white px-4 rounded-xl focus:outline-none placeholder:text-neutral-500 disabled:opacity-50"
            />

            <button
              type="submit"
              disabled={isGuest || isSending || !inputText.trim()}
              className="h-11 px-5 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer shadow-md"
            >
              {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
