import React, { useState, useEffect, useRef } from 'react';
import {
  Globe, Send, Swords, Users, UserPlus, MessageCircle, Trash2,
  Zap, Radio, ShieldCheck, X, Share2, Check, Loader2, ArrowDown, Flame
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

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTierBadgeStyle(tier?: string, role?: string): string {
  if (role === 'admin' || role === 'super_admin') {
    return 'bg-rose-500/20 text-rose-400 border-rose-500/40';
  }
  if (role === 'moderator') {
    return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
  }
  const upper = (tier || '').toUpperCase();
  if (upper.includes('LEGENDARY')) return 'bg-amber-400/20 text-amber-300 border-amber-400/40';
  if (upper.includes('GRANDMASTER') || upper.includes('MASTER')) return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
  if (upper.includes('PRO')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  return 'bg-neutral-800 text-neutral-300 border-neutral-700';
}

export const WorldChat: React.FC<WorldChatProps> = ({
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
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  useEffect(() => {
    if (!showScrollBottom) {
      scrollToBottom(true);
    }
  }, [messages.length, activeChannel]);

  const handleFeedScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    setShowScrollBottom(distanceFromBottom > 120);
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
    matchData?: { matchId: string; challengeCode: string; stakeAmount: number; gameMode: string }
  ) => {
    if (isGuest) {
      showToast('error', 'Please sign in to send messages in World Chat.');
      return;
    }
    const cleanText = textToSend.trim();
    if (!cleanText || isSending) return;

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

    // Optimistic update
    setMessages((prev) => {
      if (prev.some((m) => m.id === newMsg.id)) return prev;
      return [...prev, newMsg].slice(-200);
    });
    setInputText('');
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
    const summaryText = `🔥 OPEN ${isSquad ? '5v5 SQUAD' : '1v1 DUEL'} WAGER: ₦${match.stakeAmount.toLocaleString()} on ${match.gameMode} (${match.map}) — Code #${match.challengeCode}. Tap Accept to lock in!`;
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
      showToast('success', `Rival request transmitted to ${targetIgn}!`);
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

  return (
    <div className="rounded-3xl bg-[#090d11] border border-neutral-800 shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-210px)] min-h-[560px] max-h-[780px] relative">
      {/* CoD Tactical Header */}
      <div className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-neutral-950 via-[#0f1720] to-neutral-950 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0 relative">
            <Globe size={20} />
            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-neutral-950 ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black font-heading text-white uppercase tracking-wider">
                World Chat
              </h2>
              <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Radio size={10} className="animate-pulse" />
                {onlineCount} Online
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Public Arena Comms · Call out rivals, recruit squads & drop open wagers
            </p>
          </div>
        </div>

        {/* Channel Switcher Pills (CoD Mobile Style Tabs) */}
        <div className="flex items-center gap-1 bg-black/70 p-1 rounded-xl border border-neutral-800">
          {([
            { id: 'all', label: 'World' },
            { id: 'global', label: 'Global' },
            { id: 'wagers', label: '1v1 Wagers' },
            { id: 'lfg', label: 'Squad LFG' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleChannelSelect(tab.id)}
              className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                activeChannel === tab.id
                  ? 'bg-amber-400 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inline Toast Feedback */}
      {statusFeedback && (
        <div className={`mx-4 mt-2 px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between border animate-in fade-in ${
          statusFeedback.type === 'success'
            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
        }`}>
          <span>{statusFeedback.text}</span>
          <button onClick={() => setStatusFeedback(null)} className="opacity-70 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* World Chat Feed */}
      <div
        ref={feedRef}
        onScroll={handleFeedScroll}
        className="flex-1 overflow-y-auto px-3 sm:px-5 py-4 space-y-2.5 bg-[radial-gradient(ellipse_at_top,_rgba(251,191,36,0.03),_transparent_65%)]"
      >
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-neutral-500 gap-2">
            <Loader2 size={24} className="animate-spin text-amber-400" />
            <span className="text-xs font-mono uppercase tracking-widest">Connecting to Global Comms...</span>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400">
              <Globe size={28} />
            </div>
            <div className="text-sm font-black uppercase tracking-wider text-white">
              Channel Quiet — Break the Silence
            </div>
            <p className="text-xs text-neutral-400 max-w-sm">
              Send a message below or tap a quick callout to challenge players in the Arena.
            </p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isOwn = msg.senderId === currentUser.id;
            const isAdmin = msg.senderRole === 'admin' || msg.senderRole === 'super_admin';
            const isMod = msg.senderRole === 'moderator';
            const linkedMatch = msg.matchId
              ? openChallenges.find((m) => m.id === msg.matchId || m.challengeCode === msg.challengeCode)
              : undefined;

            return (
              <div
                key={msg.id}
                className={`group flex items-start gap-2.5 p-2.5 sm:p-3 rounded-2xl border transition-all ${
                  isOwn
                    ? 'bg-amber-400/[0.06] border-amber-400/25'
                    : isAdmin || isMod
                    ? 'bg-rose-500/[0.06] border-rose-500/25'
                    : 'bg-neutral-900/75 border-neutral-800/80 hover:border-neutral-700'
                }`}
              >
                {/* Operator Avatar */}
                <button
                  type="button"
                  onClick={() => !isOwn && setSelectedOperator(msg)}
                  className={`relative shrink-0 ${isOwn ? 'cursor-default' : 'cursor-pointer hover:scale-105 transition-transform'}`}
                  title={isOwn ? 'You' : `Inspect ${msg.senderIgn}`}
                >
                  {msg.senderAvatar ? (
                    <img
                      src={msg.senderAvatar}
                      alt={msg.senderIgn}
                      className="w-9 h-9 rounded-xl object-cover border border-neutral-700 bg-neutral-900"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400 font-black text-xs">
                      {(msg.senderIgn || msg.senderName || '?').substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </button>

                {/* Message Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                    {/* Channel Tag when viewing ALL */}
                    {activeChannel === 'all' && msg.channel !== 'global' && (
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded border ${
                        msg.channel === 'wagers'
                          ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}>
                        {msg.channel === 'wagers' ? '1V1' : 'LFG'}
                      </span>
                    )}

                    {/* Rank / Role Badge */}
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${getTierBadgeStyle(msg.senderTier, msg.senderRole)}`}>
                      {isAdmin ? 'COMMAND' : isMod ? 'MOD' : (msg.senderTier || 'ROOKIE').replace(' TIER', '')}
                    </span>

                    {/* Clan Tag */}
                    {msg.senderClan && (
                      <span className="text-[10px] font-mono text-neutral-400 font-bold">
                        {msg.senderClan}
                      </span>
                    )}

                    {/* Operator IGN */}
                    <button
                      type="button"
                      onClick={() => !isOwn && setSelectedOperator(msg)}
                      className={`text-xs font-black tracking-wide truncate ${
                        isOwn
                          ? 'text-amber-400 cursor-default'
                          : 'text-white hover:text-amber-400 cursor-pointer underline-offset-2 hover:underline'
                      }`}
                    >
                      {msg.senderIgn || msg.senderName}
                      {isOwn && <span className="text-[10px] text-neutral-500 font-normal ml-1">(You)</span>}
                    </button>

                    <span className="text-[10px] font-mono text-neutral-500 ml-auto shrink-0">
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

                  <p className="text-xs sm:text-[13px] text-neutral-200 leading-relaxed break-words">
                    {msg.text}
                  </p>

                  {/* Embedded Wager Invite Card (when shared from hosted match) */}
                  {msg.matchId && msg.stakeAmount && (
                    <div className="mt-2 p-2.5 rounded-xl bg-black/70 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/15 text-amber-400 flex items-center justify-center shrink-0">
                          <Flame size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] font-black text-white uppercase truncate">
                            #{msg.challengeCode} · ₦{msg.stakeAmount.toLocaleString()} Stake
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate">
                            {msg.gameMode || '1v1 Arena Match'}
                          </div>
                        </div>
                      </div>

                      {!isOwn && (
                        linkedMatch ? (
                          <button
                            type="button"
                            onClick={() => onAcceptChallenge(linkedMatch)}
                            className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase tracking-wider rounded-lg transition-all shadow cursor-pointer flex items-center gap-1"
                          >
                            <Swords size={12} />
                            Accept Duel
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono uppercase text-neutral-500 px-2 py-1 rounded bg-neutral-900 border border-neutral-800">
                            Match Filled / Closed
                          </span>
                        )
                      )}
                    </div>
                  )}
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
            setShowScrollBottom(false);
            scrollToBottom(true);
          }}
          className="absolute bottom-36 right-6 z-20 px-3 py-1.5 rounded-full bg-amber-400 text-neutral-950 font-black text-[10px] uppercase tracking-wider shadow-xl flex items-center gap-1 cursor-pointer hover:bg-amber-300"
        >
          <ArrowDown size={12} />
          Latest Comms
        </button>
      )}

      {/* Selected Operator Action Drawer (Challenge / Add Rival) */}
      {selectedOperator && (
        <div className="mx-3 sm:mx-5 mb-2 p-3 rounded-2xl bg-neutral-900 border border-amber-400/40 shadow-2xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black text-xs shrink-0">
              {(selectedOperator.senderIgn || '?').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white truncate">
                {selectedOperator.senderIgn}
              </div>
              <div className="text-[10px] font-mono text-neutral-400">
                {selectedOperator.senderTier || 'ROOKIE'} {selectedOperator.senderClan || ''}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                onChallengePlayer(selectedOperator.senderId);
                setSelectedOperator(null);
              }}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Swords size={12} />
              Challenge 1v1
            </button>

            <button
              type="button"
              disabled={Boolean(addedRivalIds[selectedOperator.senderId])}
              onClick={() => handleAddRival(selectedOperator.senderId, selectedOperator.senderIgn)}
              className={`px-3 py-1.5 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer border ${
                addedRivalIds[selectedOperator.senderId]
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'
              }`}
            >
              {addedRivalIds[selectedOperator.senderId] ? <Check size={12} /> : <UserPlus size={12} />}
              {addedRivalIds[selectedOperator.senderId] ? 'Request Sent' : 'Add Rival'}
            </button>

            {onNavigateToSocial && (
              <button
                type="button"
                onClick={() => {
                  setSelectedOperator(null);
                  onNavigateToSocial();
                }}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 border border-neutral-700 cursor-pointer"
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

      {/* Share Open Match Modal / Tray */}
      {showShareModal && myHostedBets.length > 0 && (
        <div className="mx-3 sm:mx-5 mb-2 p-3 rounded-2xl bg-neutral-900 border border-emerald-500/40 space-y-2 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Share2 size={13} />
              Broadcast Open Wager to World Chat
            </span>
            <button onClick={() => setShowShareModal(false)} className="text-neutral-400 hover:text-white">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto">
            {myHostedBets.map((bet) => (
              <button
                key={bet.id}
                type="button"
                onClick={() => handleShareHostedMatch(bet)}
                className="p-2.5 rounded-xl bg-black/70 hover:bg-neutral-800 border border-neutral-800 hover:border-amber-400/50 text-left flex items-center justify-between gap-2 transition-all cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-xs font-black text-amber-400 truncate">#{bet.challengeCode} · ₦{bet.stakeAmount.toLocaleString()}</div>
                  <div className="text-[10px] text-neutral-400 truncate">{bet.gameMode} · {bet.map}</div>
                </div>
                <span className="text-[10px] font-black uppercase bg-amber-400 text-neutral-950 px-2 py-1 rounded-lg shrink-0">
                  Drop
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Tactical Callouts + Input Bar */}
      <div className="p-3 sm:p-4 bg-neutral-950 border-t border-neutral-800 space-y-2.5">
        {/* Quick Callout Chips + Drop Challenge */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {myHostedBets.length > 0 && (
            <button
              type="button"
              onClick={() => setShowShareModal((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 text-amber-400 border border-amber-400/40 text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1 cursor-pointer transition-all"
            >
              <Share2 size={11} />
              Drop My Wager ({myHostedBets.length})
            </button>
          )}
          {QUICK_CALLOUTS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => dispatchMessage(q.text, q.channel)}
              className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-pointer transition-all"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Live Typing Indicator Bar */}
        {Object.values(typingUsers).length > 0 && (
          <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-400 px-1">
            <span className="flex items-center gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
            </span>
            <span>
              {Object.values(typingUsers).slice(0, 2).join(', ')}
              {Object.values(typingUsers).length > 2 ? ` +${Object.values(typingUsers).length - 2} others` : ''}{' '}
              {Object.values(typingUsers).length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSend} className="flex items-center gap-2">
          {activeChannel === 'all' && (
            <select
              value={postChannel}
              onChange={(e) => setPostChannel(e.target.value as 'global' | 'wagers' | 'lfg')}
              className="bg-neutral-900 border border-neutral-800 text-[10px] font-black uppercase text-amber-400 rounded-xl px-2.5 py-3 focus:outline-none focus:border-amber-400 shrink-0 cursor-pointer"
              title="Target Channel"
            >
              <option value="global">Global</option>
              <option value="wagers">1v1 Wager</option>
              <option value="lfg">Squad LFG</option>
            </select>
          )}

          <input
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
                ? 'Sign in to transmit in World Chat...'
                : 'Transmit to Arena World Chat (e.g. 1v1 Shipment Sniper ₦1,000)...'
            }
            className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-amber-400 text-xs sm:text-sm text-white px-4 py-3 rounded-xl focus:outline-none placeholder:text-neutral-500 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={isGuest || isSending || !inputText.trim()}
            className="px-4 sm:px-5 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 disabled:hover:bg-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
