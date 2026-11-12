import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Send, Trophy, ArrowLeft, CheckCheck, Shield, Trash2, Loader2, Sparkles,
  Swords, Copy, Check, Clock, Upload, AlertTriangle, CheckCircle2, XCircle,
  RefreshCw, X, ArrowDown, Crosshair, MapPin, ShieldCheck, Video, RotateCcw
} from 'lucide-react';
import { UserProfile, RivalChatMessage, Match } from '../types';
import { io, Socket } from 'socket.io-client';
import {
  createMatch,
  fetchMatch,
  opponentStakeMatch,
  cancelMatch,
  submitMatchResult,
  sendMutualAction,
  uploadMatchVideoWithProgress,
} from '../services/api';
import { calculateMatchEconomics } from '../utils/pricing';
import { StakePaymentModal } from './StakePaymentModal';

interface RivalChatProps {
  currentUser: UserProfile;
  rival: { id: string; codm_ign: string; avatar?: string; tier?: string };
  onChallenge?: (rivalId: string) => void;
  onBack?: () => void;
  onSyncAppState?: () => Promise<void> | void;
  openChallengeOnMount?: boolean;
}

const MODES = [
  '1v1 Sniper Only',
  '1v1 Gunfight (All Guns)',
  '1v1 Shotgun / Melee',
  '1v1 Assault / SMG',
];

const MAPS = ['Shipment', 'Nuketown', 'Killhouse', 'Firing Range', 'Standoff'];
const QUICK_STAKES = [100, 500, 1000, 2000, 5000];

function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export const RivalChat: React.FC<RivalChatProps> = ({
  currentUser,
  rival,
  onBack,
  onSyncAppState,
  openChallengeOnMount = false,
}) => {
  const [messages, setMessages] = useState<RivalChatMessage[]>([]);
  const [failedMessageIds, setFailedMessageIds] = useState<Record<string, boolean>>({});
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  // Typing indicator
  const [isRivalTyping, setIsRivalTyping] = useState(false);
  const rivalTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const myTypingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Scroll management
  const feedRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);

  // Socket ref
  const socketRef = useRef<Socket | null>(null);

  // In-chat Challenge Creation Composer
  const [showChallengeComposer, setShowChallengeComposer] = useState<boolean>(openChallengeOnMount);
  const [stakeInput, setStakeInput] = useState<string>('500');
  const [gameModeInput, setGameModeInput] = useState<string>('1v1 Sniper Only');
  const [mapInput, setMapInput] = useState<string>('Shipment');
  const [durationInput, setDurationInput] = useState<number>(15);
  const [rulesInput, setRulesInput] = useState<string>('Standard 1v1 rules. No scorestreaks/operators. Scoreboard screenshot required.');
  const [creatingMatch, setCreatingMatch] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // In-chat Match Management State
  const [chatMatches, setChatMatches] = useState<Record<string, Match>>({});
  const [activeMatchPanelExpanded, setActiveMatchPanelExpanded] = useState<boolean>(true);
  const [stakeModalMatch, setStakeModalMatch] = useState<Match | null>(null);
  const [copiedRoomCode, setCopiedRoomCode] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);

  // Result Submission inside chat
  const [resultClaims, setResultClaims] = useState<Record<string, 'VICTORY' | 'DEFEAT' | 'DRAW'>>({});
  const [resultScreenshots, setResultScreenshots] = useState<Record<string, string>>({});
  const [submittingResultId, setSubmittingResultId] = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [uploadingVideoMatchId, setUploadingVideoMatchId] = useState<string | null>(null);

  // Server time & countdown
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [countdownDisplay, setCountdownDisplay] = useState<string>('');
  const [confirmClearChat, setConfirmClearChat] = useState(false);

  const effectiveUserId =
    currentUser && currentUser.id && currentUser.id !== 'guest'
      ? currentUser.id
      : typeof window !== 'undefined'
      ? localStorage.getItem('codm_current_user_id') || currentUser.id
      : currentUser.id;

  const effectiveIgn =
    currentUser && currentUser.codmIgn && currentUser.codmIgn !== 'CODM_Gamer'
      ? currentUser.codmIgn
      : currentUser.username || 'Gladiator';

  // Check whether a message belongs specifically to THIS 1v1 conversation
  const belongsToThisConversation = useCallback(
    (m: any): boolean => {
      if (!m) return false;
      const sId = m.senderId || m.sender_id || m.userId || m.user_id || '';
      const rId = m.rivalId || m.rival_id || '';
      const uId = m.userId || m.user_id || '';
      const participants = new Set([sId, rId, uId].filter(Boolean));
      return participants.has(effectiveUserId) && participants.has(rival.id);
    },
    [effectiveUserId, rival.id]
  );

  const normalizeMsg = useCallback(
    (m: any): RivalChatMessage => {
      const sId = m.senderId || m.sender_id || m.userId || m.user_id || '';
      const isMe = sId === effectiveUserId;
      const sName = m.senderName || m.sender_name || (isMe ? effectiveIgn : rival.codm_ign);

      return {
        id: m.id || `rival_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        rivalId: m.rivalId || m.rival_id || rival.id,
        userId: m.userId || m.user_id || effectiveUserId,
        senderId: sId,
        senderName: sName,
        text: m.text || '',
        timestamp: Number(m.timestamp) || Date.now(),
        matchId: m.matchId || m.match_id || undefined,
        msgType: m.msgType || m.msg_type || (m.matchId || m.match_id ? 'challenge' : 'text'),
      };
    },
    [effectiveUserId, effectiveIgn, rival.id, rival.codm_ign]
  );

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const handleScroll = () => {
    if (!feedRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 90;
    isNearBottomRef.current = nearBottom;
    setShowScrollBottom(!nearBottom);
    if (nearBottom) setUnreadWhileScrolled(0);
  };

  // Load match objects for any matchId mentioned in chat messages
  const syncReferencedMatches = useCallback(async (msgList: RivalChatMessage[]) => {
    const matchIds = Array.from(
      new Set(msgList.map((m) => m.matchId).filter((id): id is string => Boolean(id)))
    );
    if (matchIds.length === 0) return;

    const fetched = await Promise.all(
      matchIds.map(async (id) => {
        try {
          return await fetchMatch(id);
        } catch {
          return null;
        }
      })
    );

    setChatMatches((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const m of fetched) {
        if (m && m.id) {
          next[m.id] = m;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const fetchHistory = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingHistory(true);
      try {
        const res = await fetch(`/api/friends/chat/${rival.id}?userId=${encodeURIComponent(effectiveUserId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data && Array.isArray(data.messages)) {
          const incoming = data.messages.map(normalizeMsg);

          setMessages((prev) => {
            const byId = new Map<string, RivalChatMessage>();
            const now = Date.now();
            // Keep very recent optimistic local messages (<15s) that haven't settled on DB read yet
            for (const existing of prev) {
              if (now - existing.timestamp < 15000) {
                byId.set(existing.id, existing);
              }
            }
            for (const msg of incoming) {
              byId.set(msg.id, msg);
            }
            const merged = Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);

            // Prevent unnecessary re-render / scroll jitter if nothing changed
            if (
              merged.length === prev.length &&
              merged.every((m, idx) => m.id === prev[idx].id && m.text === prev[idx].text)
            ) {
              return prev;
            }
            return merged;
          });

          syncReferencedMatches(incoming);
        }
      } catch (err) {
        console.warn('Failed to load chat history:', err);
      } finally {
        if (!silent) setLoadingHistory(false);
      }
    },
    [effectiveUserId, rival.id, normalizeMsg, syncReferencedMatches]
  );

  // Sync server clock offset for live duel countdown
  useEffect(() => {
    fetch('/api/server-time')
      .then((r) => r.json())
      .then((d) => {
        if (d?.serverTime) setServerTimeOffset(d.serverTime - Date.now());
      })
      .catch(() => {});
  }, []);

  // Main Socket & Lifecycle Effect
  useEffect(() => {
    setMessages([]);
    setIsRivalTyping(false);
    isNearBottomRef.current = true;
    fetchHistory(false);

    const s = io('/', {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = s;

    const room = `rival_chat_${[rival.id, effectiveUserId].sort().join('_')}`;

    const onConnect = () => {
      setIsConnected(true);
      s.emit('join_rival_room', { room });
      fetchHistory(true);
    };

    if (s.connected) {
      onConnect();
    }

    s.on('connect', onConnect);
    s.on('disconnect', () => setIsConnected(false));

    const handleIncomingMessage = (rawMsg: any) => {
      if (!belongsToThisConversation(rawMsg)) return;
      const msg = normalizeMsg(rawMsg);

      if (msg.senderId === rival.id) {
        setIsRivalTyping(false);
        if (rivalTypingTimeoutRef.current) clearTimeout(rivalTypingTimeoutRef.current);
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        if (!isNearBottomRef.current && msg.senderId !== effectiveUserId) {
          setUnreadWhileScrolled((c) => c + 1);
        }
        return [...prev, msg].sort((a, b) => a.timestamp - b.timestamp);
      });

      if (msg.matchId) {
        fetchMatch(msg.matchId)
          .then((m) => {
            if (m && m.id) {
              setChatMatches((prev) => ({ ...prev, [m.id]: m }));
            }
          })
          .catch(() => {});
      }
    };

    s.on('rival_chat', handleIncomingMessage);
    s.on(`rival_chat_${effectiveUserId}`, handleIncomingMessage);

    const handleTypingEvent = (data: any) => {
      if (!data || data.userId !== rival.id) return;
      // Only show typing if aimed at us
      if (data.rivalId && data.rivalId !== effectiveUserId) return;

      setIsRivalTyping(Boolean(data.isTyping));
      if (rivalTypingTimeoutRef.current) clearTimeout(rivalTypingTimeoutRef.current);
      if (data.isTyping) {
        rivalTypingTimeoutRef.current = setTimeout(() => {
          setIsRivalTyping(false);
        }, 4000);
      }
    };

    s.on('rival_typing', handleTypingEvent);
    s.on(`rival_typing_${effectiveUserId}`, handleTypingEvent);

    s.on('rival_chat_cleared', (data: any) => {
      if (data && (data.rivalId === rival.id || data.userId === rival.id)) {
        setMessages([]);
      }
    });

    // Real-time Match Updates for challenges managed inside chat
    const handleMatchSync = (updatedMatch: Match) => {
      if (!updatedMatch || !updatedMatch.id) return;
      setChatMatches((prev) => {
        if (!prev[updatedMatch.id]) return prev;
        return { ...prev, [updatedMatch.id]: updatedMatch };
      });
    };

    s.on('matchUpdated', handleMatchSync);
    s.on('matchSettled', handleMatchSync);

    // Gentle safety sync every 10s (does not overwrite state unless changed)
    const pollTimer = setInterval(() => {
      fetchHistory(true);
    }, 10000);

    return () => {
      clearInterval(pollTimer);
      if (rivalTypingTimeoutRef.current) clearTimeout(rivalTypingTimeoutRef.current);
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      s.disconnect();
    };
  }, [effectiveUserId, rival.id, belongsToThisConversation, normalizeMsg, fetchHistory]);

  // Smart auto-scroll when messages arrive while user is near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom(true);
    }
  }, [messages.length, isRivalTyping]);

  // Identify latest active match between these two players (for sticky HUD bar)
  const challengeMatchesInChat = messages
    .map((m) => (m.matchId ? chatMatches[m.matchId] : undefined))
    .filter((m): m is Match => Boolean(m));

  const latestActiveDuel = [...challengeMatchesInChat]
    .reverse()
    .find((m) =>
      ['PENDING_OPPONENT_STAKE', 'OPPONENT_STAKED_AWAITING_CREATOR', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(
        m.status
      )
    );

  // Live countdown timer for active duel in chat
  useEffect(() => {
    if (!latestActiveDuel?.roomGeneratedAt || !latestActiveDuel?.matchDurationMinutes) {
      setCountdownDisplay('');
      return;
    }
    const targetTime = latestActiveDuel.roomGeneratedAt + latestActiveDuel.matchDurationMinutes * 60 * 1000;
    const tick = () => {
      const diff = targetTime - (Date.now() + serverTimeOffset);
      if (diff <= 0) {
        setCountdownDisplay('00:00');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCountdownDisplay(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [latestActiveDuel?.id, latestActiveDuel?.roomGeneratedAt, latestActiveDuel?.matchDurationMinutes, serverTimeOffset]);

  // Helper to send a message reliably via REST (single authoritative DB write + socket room emit)
  const sendChatPayload = async (payload: RivalChatMessage) => {
    // Clear failed flag if retrying
    setFailedMessageIds((prev) => {
      if (!prev[payload.id]) return prev;
      const next = { ...prev };
      delete next[payload.id];
      return next;
    });

    setMessages((prev) => {
      if (prev.some((m) => m.id === payload.id)) return prev;
      return [...prev, payload];
    });
    isNearBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 40);

    try {
      const res = await fetch('/api/friends/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        throw new Error('Failed to send');
      }
    } catch (err) {
      console.warn('Message delivery failed:', err);
      setFailedMessageIds((prev) => ({ ...prev, [payload.id]: true }));
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const textToSend = inputText.trim();
    if (!textToSend || isSending) return;

    setIsSending(true);
    setInputText('');

    // Stop typing indicator immediately
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    socketRef.current?.emit('rival_typing', {
      userId: effectiveUserId,
      rivalId: rival.id,
      senderName: effectiveIgn,
      isTyping: false,
    });

    const msgId = `rival_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const newMsg: RivalChatMessage = {
      id: msgId,
      rivalId: rival.id,
      userId: effectiveUserId,
      senderId: effectiveUserId,
      senderName: effectiveIgn,
      text: textToSend,
      timestamp: Date.now(),
      msgType: 'text',
    };

    try {
      await sendChatPayload(newMsg);
    } finally {
      setIsSending(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (!socketRef.current?.connected) return;

    if (val.trim().length > 0) {
      socketRef.current.emit('rival_typing', {
        userId: effectiveUserId,
        rivalId: rival.id,
        senderName: effectiveIgn,
        isTyping: true,
      });
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      myTypingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit('rival_typing', {
          userId: effectiveUserId,
          rivalId: rival.id,
          senderName: effectiveIgn,
          isTyping: false,
        });
      }, 2000);
    } else {
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      socketRef.current.emit('rival_typing', {
        userId: effectiveUserId,
        rivalId: rival.id,
        senderName: effectiveIgn,
        isTyping: false,
      });
    }
  };

  // Create Challenge Directly Inside Chat
  const handleCreateInChatChallenge = async () => {
    const parsedStake = parseInt(stakeInput, 10);
    if (!stakeInput.trim() || isNaN(parsedStake) || parsedStake < 100) {
      setComposerError('Minimum wager stake is ₦100');
      return;
    }
    if ((currentUser.balance || 0) < parsedStake) {
      setComposerError(`Insufficient balance (₦${(currentUser.balance || 0).toLocaleString()}). Fund your wallet first.`);
      return;
    }

    setCreatingMatch(true);
    setComposerError(null);
    try {
      const created = await createMatch({
        creatorId: effectiveUserId,
        stakeAmount: parsedStake,
        gameMode: gameModeInput,
        map: mapInput,
        rules: [
          rulesInput.trim() || 'Standard 1v1 rules agreed in chat',
          'No cheat modifications or glitches',
          'Post-match scoreboard screenshot required for verification',
        ],
        matchDurationMinutes: durationInput,
        isPublic: false, // Private challenge managed inside this chat
        matchType: 'solo',
      });

      if (created && created.id) {
        setChatMatches((prev) => ({ ...prev, [created.id]: created }));
        setShowChallengeComposer(false);
        setActiveMatchPanelExpanded(true);

        const challengeMsg: RivalChatMessage = {
          id: `rival_chal_${created.id}_${Date.now()}`,
          rivalId: rival.id,
          userId: effectiveUserId,
          senderId: effectiveUserId,
          senderName: effectiveIgn,
          text: `⚔️ 1v1 CHALLENGE SENT: ₦${parsedStake.toLocaleString()} on ${gameModeInput} (${mapInput}) · Winner Payout ₦${created.winnerPayout.toLocaleString()}`,
          timestamp: Date.now(),
          matchId: created.id,
          msgType: 'challenge',
        };
        await sendChatPayload(challengeMsg);
        if (onSyncAppState) await onSyncAppState();
      }
    } catch (err: any) {
      setComposerError(err.message || 'Failed to create 1v1 challenge');
    } finally {
      setCreatingMatch(false);
    }
  };

  // Rival Accepts & Stakes Directly Inside Chat
  const handleConfirmInChatStake = async (paymentMethod: 'wallet_balance' | 'flutterwave') => {
    if (!stakeModalMatch) return;
    setMatchError(null);
    const updated = await opponentStakeMatch(stakeModalMatch.id, {
      opponentId: effectiveUserId,
      paymentMethod,
    });
    if (updated && updated.id) {
      setChatMatches((prev) => ({ ...prev, [updated.id]: updated }));
      setStakeModalMatch(null);
      setActiveMatchPanelExpanded(true);

      await sendChatPayload({
        id: `rival_sys_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        rivalId: rival.id,
        userId: effectiveUserId,
        senderId: effectiveUserId,
        senderName: effectiveIgn,
        text: `✅ ACCEPTED & STAKED ₦${updated.stakeAmount.toLocaleString()}! Private Room Code is now live.`,
        timestamp: Date.now(),
        matchId: updated.id,
        msgType: 'system',
      });
      if (onSyncAppState) await onSyncAppState();
    }
  };

  // Creator Cancels Open Challenge Inside Chat
  const handleCancelChallenge = async (match: Match) => {
    setActionBusyId(match.id);
    setMatchError(null);
    try {
      const updated = await cancelMatch(match.id);
      if (updated && updated.id) {
        setChatMatches((prev) => ({ ...prev, [updated.id]: updated }));
      }
      await sendChatPayload({
        id: `rival_sys_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        rivalId: rival.id,
        userId: effectiveUserId,
        senderId: effectiveUserId,
        senderName: effectiveIgn,
        text: `❌ Challenge #${match.challengeCode} was cancelled & refunded.`,
        timestamp: Date.now(),
        matchId: match.id,
        msgType: 'system',
      });
      if (onSyncAppState) await onSyncAppState();
    } catch (err: any) {
      setMatchError(err.message || 'Could not cancel challenge');
    } finally {
      setActionBusyId(null);
    }
  };

  // Rival Declines Challenge Inside Chat
  const handleDeclineChallenge = async (match: Match) => {
    setActionBusyId(match.id);
    setMatchError(null);
    try {
      const updated = await cancelMatch(match.id);
      if (updated && updated.id) {
        setChatMatches((prev) => ({ ...prev, [updated.id]: updated }));
      }
      await sendChatPayload({
        id: `rival_sys_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        rivalId: rival.id,
        userId: effectiveUserId,
        senderId: effectiveUserId,
        senderName: effectiveIgn,
        text: `🚫 Declined challenge #${match.challengeCode} (₦${match.stakeAmount.toLocaleString()} refunded to host).`,
        timestamp: Date.now(),
        matchId: match.id,
        msgType: 'system',
      });
      if (onSyncAppState) await onSyncAppState();
    } catch (err: any) {
      setMatchError(err.message || 'Could not decline challenge');
    } finally {
      setActionBusyId(null);
    }
  };

  // Submit Result Inside Chat
  const handleInChatSubmitResult = async (match: Match) => {
    const claim = resultClaims[match.id] || 'VICTORY';
    const screenshotBase64 = resultScreenshots[match.id];
    setSubmittingResultId(match.id);
    setMatchError(null);
    try {
      const updated = await submitMatchResult(match.id, {
        playerId: effectiveUserId,
        claim,
        screenshotBase64,
      });
      if (updated && updated.id) {
        setChatMatches((prev) => ({ ...prev, [updated.id]: updated }));
      }
      await sendChatPayload({
        id: `rival_sys_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        rivalId: rival.id,
        userId: effectiveUserId,
        senderId: effectiveUserId,
        senderName: effectiveIgn,
        text: `📸 Submitted result claim: ${claim} for #${match.challengeCode}.`,
        timestamp: Date.now(),
        matchId: match.id,
        msgType: 'system',
      });
      if (onSyncAppState) await onSyncAppState();
    } catch (err: any) {
      setMatchError(err.message || 'Failed to submit result');
    } finally {
      setSubmittingResultId(null);
    }
  };

  // Handle Screenshot file selection inside chat
  const handleScreenshotSelect = (matchId: string, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setResultScreenshots((prev) => ({ ...prev, [matchId]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Dispute Video upload inside chat
  const handleDisputeVideoUpload = async (matchId: string, file?: File) => {
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      setMatchError('Video exceeds 200MB limit.');
      return;
    }
    setUploadingVideoMatchId(matchId);
    setVideoUploadProgress(0);
    setMatchError(null);
    try {
      await uploadMatchVideoWithProgress(matchId, file, effectiveUserId, effectiveIgn, (pct) => {
        setVideoUploadProgress(pct);
      });
      const updated = await fetchMatch(matchId);
      if (updated) setChatMatches((prev) => ({ ...prev, [updated.id]: updated }));
      await sendChatPayload({
        id: `rival_sys_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        rivalId: rival.id,
        userId: effectiveUserId,
        senderId: effectiveUserId,
        senderName: effectiveIgn,
        text: `🎥 Uploaded gameplay video evidence for #${updated?.challengeCode || matchId}.`,
        timestamp: Date.now(),
        matchId,
        msgType: 'system',
      });
    } catch (err: any) {
      setMatchError(err.message || 'Video upload failed');
    } finally {
      setUploadingVideoMatchId(null);
    }
  };

  // Mutual Action Inside Chat
  const handleMutualAction = async (
    match: Match,
    action: 'REQUEST_RESTART_TIMER' | 'REQUEST_MUTUAL_REFUND' | 'ACCEPT_ACTION' | 'DECLINE_ACTION'
  ) => {
    setActionBusyId(match.id);
    setMatchError(null);
    try {
      const res = await sendMutualAction(match.id, effectiveUserId, action);
      if (res?.match) {
        setChatMatches((prev) => ({ ...prev, [res.match.id]: res.match }));
      }
      if (onSyncAppState) await onSyncAppState();
    } catch (err: any) {
      setMatchError(err.message || 'Mutual action failed');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleClearChat = async () => {
    try {
      const res = await fetch(`/api/friends/chat/${rival.id}?userId=${encodeURIComponent(effectiveUserId)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessages([]);
        setConfirmClearChat(false);
      }
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedRoomCode(code);
    setTimeout(() => setCopiedRoomCode(null), 2000);
  };

  const parsedStake = parseInt(stakeInput, 10) || 0;
  const economics = calculateMatchEconomics(Math.max(0, parsedStake));

  // Render an inline Interactive Challenge Card for a matchId
  const renderMatchChallengeCard = (match: Match) => {
    const isCreator = match.creator.id === effectiveUserId;
    const isOpen = match.status === 'PENDING_OPPONENT_STAKE';
    const isLivePlay = ['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS'].includes(match.status);
    const isVerifying = match.status === 'VERIFYING';
    const isDisputed = match.status === 'DISPUTED';
    const isSettled = match.status === 'SETTLED';
    const isClosed = ['CANCELLED', 'ABANDONED', 'ABANDONED_AND_SETTLED'].includes(match.status);

    const myParticipant = isCreator ? match.creator : match.opponent;
    const iAlreadySubmitted = Boolean(myParticipant?.resultClaim);
    const otherSubmitted = isCreator ? Boolean(match.opponent?.resultClaim) : Boolean(match.creator?.resultClaim);

    return (
      <div className="mt-2 p-3.5 rounded-2xl bg-[#090d11] border border-amber-400/40 shadow-xl space-y-3 text-left">
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 border-b border-neutral-800 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
              <Swords size={14} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white uppercase truncate font-heading">
                {match.gameMode} · {match.map}
              </div>
              <div className="text-[10px] font-mono text-neutral-400">#{match.challengeCode}</div>
            </div>
          </div>

          <span
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${
              isOpen
                ? 'bg-amber-400/15 text-amber-300 border-amber-400/40'
                : isLivePlay
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                : isSettled
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : isDisputed
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : 'bg-neutral-800 text-neutral-400 border-neutral-700'
            }`}
          >
            {match.status.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Economics Row */}
        <div className="grid grid-cols-3 gap-2 p-2 rounded-xl bg-black/60 border border-neutral-800/80 text-center font-mono">
          <div>
            <div className="text-[9px] text-neutral-500 uppercase">Stake</div>
            <div className="text-xs font-black text-white">₦{match.stakeAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] text-neutral-500 uppercase">Total Pot</div>
            <div className="text-xs font-black text-amber-400">₦{match.potAmount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-[9px] text-neutral-500 uppercase">Win Payout</div>
            <div className="text-xs font-black text-emerald-400">₦{match.winnerPayout.toLocaleString()}</div>
          </div>
        </div>

        {/* Stage 1: Pending Opponent Stake */}
        {isOpen && (
          <div className="space-y-2">
            {isCreator ? (
              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-amber-300/90 font-mono flex items-center gap-1.5">
                  <Loader2 size={12} className="animate-spin" />
                  Awaiting {rival.codm_ign} to stake...
                </span>
                <button
                  type="button"
                  disabled={actionBusyId === match.id}
                  onClick={() => handleCancelChallenge(match)}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase cursor-pointer"
                >
                  {actionBusyId === match.id ? 'Cancelling...' : 'Cancel & Refund'}
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setStakeModalMatch(match)}
                  className="py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider shadow cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Swords size={13} />
                  Accept & Stake ₦{match.stakeAmount.toLocaleString()}
                </button>
                <button
                  type="button"
                  disabled={actionBusyId === match.id}
                  onClick={() => handleDeclineChallenge(match)}
                  className="py-2 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase tracking-wider border border-neutral-700 cursor-pointer"
                >
                  {actionBusyId === match.id ? 'Declining...' : 'Decline'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stage 2: Ready to Play / Live Duel Controls */}
        {isLivePlay && (
          <div className="space-y-3">
            {/* Room Code + Timer */}
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-2">
              <div>
                <div className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">
                  CODM Private Room Code
                </div>
                <div className="text-sm font-mono font-black text-white tracking-widest">
                  {match.roomCode || 'GENERATING...'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {countdownDisplay && (
                  <span className="px-2 py-1 rounded-lg bg-black/60 border border-neutral-800 text-[11px] font-mono text-amber-400 font-bold flex items-center gap-1">
                    <Clock size={11} />
                    {countdownDisplay}
                  </span>
                )}
                {match.roomCode && (
                  <button
                    type="button"
                    onClick={() => copyCode(match.roomCode!)}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-[10px] uppercase flex items-center gap-1 cursor-pointer"
                  >
                    {copiedRoomCode === match.roomCode ? <Check size={12} /> : <Copy size={12} />}
                    {copiedRoomCode === match.roomCode ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>
            </div>

            {/* Result Submission inside Chat */}
            {iAlreadySubmitted ? (
              <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs flex items-center justify-between">
                <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Your Claim: {myParticipant?.resultClaim}
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">
                  {otherSubmitted ? 'Verifying both claims...' : `Waiting for ${rival.codm_ign}...`}
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-2.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-neutral-300">
                  Submit Match Result (Inside Chat)
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(['VICTORY', 'DEFEAT', 'DRAW'] as const).map((claim) => {
                    const selected = (resultClaims[match.id] || 'VICTORY') === claim;
                    return (
                      <button
                        key={claim}
                        type="button"
                        onClick={() => setResultClaims((prev) => ({ ...prev, [match.id]: claim }))}
                        className={`py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                          selected
                            ? claim === 'VICTORY'
                              ? 'bg-emerald-500 text-neutral-950 border-emerald-400'
                              : claim === 'DEFEAT'
                              ? 'bg-rose-500 text-white border-rose-400'
                              : 'bg-amber-400 text-neutral-950 border-amber-300'
                            : 'bg-black/60 text-neutral-400 border-neutral-800 hover:text-white'
                        }`}
                      >
                        {claim}
                      </button>
                    );
                  })}
                </div>

                {/* Screenshot Upload */}
                <div className="flex items-center gap-2">
                  <label className="flex-1 py-2 px-3 rounded-xl bg-black/70 hover:bg-neutral-800 border border-dashed border-neutral-700 text-[10px] font-bold text-neutral-300 flex items-center justify-center gap-1.5 cursor-pointer">
                    <Upload size={12} className="text-amber-400" />
                    <span>{resultScreenshots[match.id] ? 'Screenshot Attached ✓' : 'Attach Scoreboard Screenshot'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleScreenshotSelect(match.id, e.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={submittingResultId === match.id}
                    onClick={() => handleInChatSubmitResult(match)}
                    className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50"
                  >
                    {submittingResultId === match.id ? 'Sending...' : 'Submit Result'}
                  </button>
                </div>
              </div>
            )}

            {/* Mutual Agreement Controls inside Chat */}
            {match.mutualActionState ? (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-amber-300 font-bold">
                  {match.mutualActionState.requestedBy === effectiveUserId
                    ? `Waiting for ${rival.codm_ign} to approve ${match.mutualActionState.action.replace('_', ' ')}`
                    : `${match.mutualActionState.requestedByName} requested ${match.mutualActionState.action.replace('_', ' ')}`}
                </span>
                {match.mutualActionState.requestedBy !== effectiveUserId && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMutualAction(match, 'ACCEPT_ACTION')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500 text-neutral-950 font-black text-[10px] uppercase cursor-pointer"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMutualAction(match, 'DECLINE_ACTION')}
                      className="px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-300 font-bold text-[10px] uppercase cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-end gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleMutualAction(match, 'REQUEST_RESTART_TIMER')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 font-bold uppercase cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw size={10} />
                  Restart Timer
                </button>
                <button
                  type="button"
                  onClick={() => handleMutualAction(match, 'REQUEST_MUTUAL_REFUND')}
                  className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-rose-300 border border-neutral-800 font-bold uppercase cursor-pointer"
                >
                  Mutual Refund
                </button>
              </div>
            )}
          </div>
        )}

        {/* Stage 3: Verifying or Disputed */}
        {(isVerifying || isDisputed) && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-300">
              <AlertTriangle size={14} />
              <span>{isDisputed ? 'Match Disputed — Moderator Review' : 'AI Verification In Progress'}</span>
            </div>
            {isDisputed && (
              <label className="w-full py-2 px-3 rounded-xl bg-black/70 hover:bg-neutral-800 border border-rose-500/30 text-[10px] font-black uppercase text-rose-200 flex items-center justify-center gap-1.5 cursor-pointer">
                <Video size={12} />
                <span>
                  {uploadingVideoMatchId === match.id
                    ? `Uploading Video ${videoUploadProgress}%...`
                    : 'Upload Gameplay Video Proof'}
                </span>
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => handleDisputeVideoUpload(match.id, e.target.files?.[0])}
                />
              </label>
            )}
          </div>
        )}

        {/* Stage 4: Settled / Closed */}
        {(isSettled || isClosed) && (
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
              {isSettled ? (
                <>
                  <Trophy size={14} className="text-amber-400" />
                  <span>
                    {match.winnerIgn?.includes('DRAW')
                      ? 'Match Draw — Stakes Refunded'
                      : `Winner: ${match.winnerIgn} (+₦${match.winnerPayout.toLocaleString()})`}
                  </span>
                </>
              ) : (
                <span className="text-neutral-400 flex items-center gap-1">
                  <XCircle size={13} />
                  {match.status}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setStakeInput(match.stakeAmount.toString());
                setGameModeInput(match.gameMode);
                setMapInput(match.map);
                setShowChallengeComposer(true);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase cursor-pointer"
            >
              Rematch
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-135px)] min-h-[580px] bg-[#0c1317] border border-neutral-800 rounded-2xl overflow-hidden shadow-2xl font-sans relative">
      {/* Tactical Top Bar */}
      <div className="px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#2a3942] transition-colors cursor-pointer shrink-0"
              title="Back to Rivals Roster"
            >
              <ArrowLeft size={18} />
            </button>
          )}

          <div className="relative shrink-0">
            <img
              src={rival.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rival.codm_ign)}`}
              alt={rival.codm_ign}
              className="w-10 h-10 rounded-full bg-neutral-800 border border-emerald-500/40 object-cover"
            />
            <span
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#1f2c34] ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm tracking-wide font-heading truncate">
                {rival.codm_ign}
              </span>
              <span
                className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border shrink-0 ${
                  isConnected
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {isConnected ? 'Live' : 'Syncing'}
              </span>
            </div>
            <div className="text-[10px] font-mono flex items-center gap-1 h-4">
              {isRivalTyping ? (
                <span className="text-emerald-400 font-bold animate-pulse">typing...</span>
              ) : (
                <span className="text-emerald-500/80 flex items-center gap-1">
                  <Shield size={10} />
                  <span>Encrypted 1v1 Duel Channel</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center gap-2 shrink-0">
          {messages.length > 0 && !confirmClearChat && (
            <button
              onClick={() => setConfirmClearChat(true)}
              className="p-2 rounded-xl text-neutral-400 hover:text-rose-400 hover:bg-[#2a3942] transition-colors cursor-pointer"
              title="Clear conversation history"
            >
              <Trash2 size={16} />
            </button>
          )}
          {confirmClearChat && (
            <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 px-2 py-1 rounded-xl">
              <button
                onClick={handleClearChat}
                className="text-[10px] font-black text-rose-300 hover:text-white uppercase cursor-pointer"
              >
                Confirm Clear
              </button>
              <button
                onClick={() => setConfirmClearChat(false)}
                className="text-neutral-400 hover:text-white ml-1 cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <button
            onClick={() => {
              setComposerError(null);
              setShowChallengeComposer((v) => !v);
            }}
            className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 px-3 py-2 rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md active:scale-95 cursor-pointer font-heading"
          >
            <Swords size={14} className="stroke-[2.5]" />
            <span>{showChallengeComposer ? 'Close Setup' : 'Challenge 1v1'}</span>
          </button>
        </div>
      </div>

      {/* Sticky Active Duel HUD Banner (when a challenge between you and rival is active) */}
      {latestActiveDuel && (
        <div className="bg-[#111b21] border-b border-amber-500/30 px-4 py-2.5 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="text-xs font-black text-white uppercase truncate font-heading">
                Active Duel #{latestActiveDuel.challengeCode} · ₦{latestActiveDuel.stakeAmount.toLocaleString()}
              </span>
              {latestActiveDuel.roomCode && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-black">
                  ROOM: {latestActiveDuel.roomCode}
                </span>
              )}
              {countdownDisplay && (
                <span className="text-[10px] font-mono text-amber-400 font-bold">{countdownDisplay}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setActiveMatchPanelExpanded((v) => !v)}
              className="text-[10px] font-black uppercase tracking-wider text-amber-400 hover:text-amber-300 cursor-pointer shrink-0"
            >
              {activeMatchPanelExpanded ? 'Hide Duel HUD ▲' : 'Manage Duel ▼'}
            </button>
          </div>
          {activeMatchPanelExpanded && (
            <div className="mt-2">{renderMatchChallengeCard(latestActiveDuel)}</div>
          )}
        </div>
      )}

      {/* Match Error Banner */}
      {matchError && (
        <div className="mx-4 mt-2 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold flex items-center justify-between shrink-0">
          <span>{matchError}</span>
          <button onClick={() => setMatchError(null)} className="text-rose-200 hover:text-white">
            <X size={14} />
          </button>
        </div>
      )}

      {/* In-Chat Challenge Setup Drawer */}
      {showChallengeComposer && (
        <div className="p-4 bg-[#111b21] border-b border-amber-400/40 space-y-3 shrink-0 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Swords size={16} className="text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider text-white font-heading">
                Send 1v1 Challenge to {rival.codm_ign} (Managed in Chat)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowChallengeComposer(false)}
              className="text-neutral-400 hover:text-white cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {composerError && (
            <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
              {composerError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                <Crosshair size={10} className="inline mr-1 text-amber-400" />
                Game Mode
              </label>
              <select
                value={gameModeInput}
                onChange={(e) => setGameModeInput(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                {MODES.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                <MapPin size={10} className="inline mr-1 text-amber-400" />
                Map
              </label>
              <select
                value={mapInput}
                onChange={(e) => setMapInput(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
              >
                {MAPS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                Stake (₦) · Balance: <span className="text-emerald-400">₦{(currentUser.balance || 0).toLocaleString()}</span>
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={100}
                  value={stakeInput}
                  onChange={(e) => setStakeInput(e.target.value)}
                  className="w-24 bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:border-amber-400 focus:outline-none"
                />
                <div className="flex items-center gap-1 overflow-x-auto">
                  {QUICK_STAKES.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setStakeInput(amt.toString())}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-mono font-bold border cursor-pointer ${
                        parsedStake === amt
                          ? 'bg-amber-400 text-neutral-950 border-amber-300'
                          : 'bg-neutral-900 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      ₦{amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-neutral-400 block mb-1">
                Match Duration
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {[15, 20, 30].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationInput(mins)}
                    className={`py-2 rounded-xl text-xs font-mono font-bold border cursor-pointer ${
                      durationInput === mins
                        ? 'bg-amber-400 text-neutral-950 border-amber-300'
                        : 'bg-neutral-950 text-neutral-300 border-neutral-800'
                    }`}
                  >
                    {mins} mins
                  </button>
                ))}
              </div>
            </div>
          </div>

          <input
            type="text"
            value={rulesInput}
            onChange={(e) => setRulesInput(e.target.value)}
            placeholder="Match rules (e.g. Snipers only, no scorestreaks)..."
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="text-xs font-mono text-neutral-300">
              Winner Payout:{' '}
              <strong className="text-emerald-400">₦{economics.winnerPayout.toLocaleString()}</strong>
              <span className="text-neutral-500 text-[10px] ml-1.5">
                (Pot ₦{economics.potAmount.toLocaleString()} · Fee {economics.rakePercentFormatted})
              </span>
            </div>
            <button
              type="button"
              disabled={creatingMatch}
              onClick={handleCreateInChatChallenge}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider shadow cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {creatingMatch ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
              {creatingMatch ? 'Locking Escrow...' : `Send Challenge (₦${parsedStake.toLocaleString()})`}
            </button>
          </div>
        </div>
      )}

      {/* Message Area */}
      <div
        ref={feedRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#0b141a]"
      >
        <div className="flex justify-center mb-3">
          <div className="px-4 py-1.5 rounded-full bg-[#182229] border border-white/5 text-[11px] text-[#8696a0] font-mono text-center">
            🔒 Encrypted 1v1 Channel · Challenges, staking, room codes & results are managed right here in chat.
          </div>
        </div>

        {loadingHistory ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-neutral-500">
            <Loader2 size={24} className="animate-spin text-amber-400" />
            <span className="text-xs font-mono">Syncing encrypted chat history...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#1f2c34] flex items-center justify-center text-amber-400 mx-auto">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-sm font-bold text-white font-heading uppercase">No Messages Yet</p>
              <p className="text-xs text-[#8696a0] mt-1 max-w-xs mx-auto">
                Chat with {rival.codm_ign}, agree on loadout rules, or tap Challenge 1v1 to duel right inside chat!
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const isMe = m.senderId === effectiveUserId;
            const linkedMatch = m.matchId ? chatMatches[m.matchId] : undefined;
            const isFailed = Boolean(failedMessageIds[m.id]);

            if (m.msgType === 'system' && !linkedMatch) {
              return (
                <div key={m.id} className="flex justify-center">
                  <span className="px-3 py-1 rounded-full bg-[#182229] border border-neutral-800 text-[11px] font-mono text-amber-300/90 text-center">
                    {m.text}
                  </span>
                </div>
              );
            }

            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`p-3 rounded-2xl shadow-sm max-w-[90%] sm:max-w-[78%] break-words relative ${
                    m.msgType === 'challenge'
                      ? 'bg-[#131f27] text-white border border-amber-400/40 w-full sm:w-[390px]'
                      : isMe
                      ? 'bg-[#005c4b] text-white rounded-tr-none'
                      : 'bg-[#202c33] text-[#e9edef] rounded-tl-none border border-white/5'
                  }`}
                >
                  {!isMe && (
                    <p className="text-[10px] font-bold text-amber-400 mb-0.5 uppercase tracking-tight font-heading">
                      {m.senderName || rival.codm_ign}
                    </p>
                  )}

                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.text}</p>

                  {m.msgType === 'challenge' && linkedMatch && renderMatchChallengeCard(linkedMatch)}

                  <div className="flex items-center justify-end mt-1 gap-1.5 text-[9px] text-[#8696a0]">
                    {isFailed && (
                      <button
                        type="button"
                        onClick={() => sendChatPayload(m)}
                        className="text-rose-400 font-bold flex items-center gap-1 hover:underline cursor-pointer mr-1"
                      >
                        <RefreshCw size={10} />
                        Retry
                      </button>
                    )}
                    <span>{formatTime(m.timestamp)}</span>
                    {isMe && !isFailed && <CheckCheck size={12} className="text-emerald-400" />}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Animated Typing Indicator Bubble */}
        {isRivalTyping && (
          <div className="flex justify-start animate-in fade-in duration-150">
            <div className="px-4 py-2.5 rounded-2xl rounded-tl-none bg-[#202c33] border border-white/5 flex items-center gap-2">
              <span className="text-[11px] font-bold text-amber-400">{rival.codm_ign}</span>
              <span className="text-[11px] text-[#8696a0] italic">is typing</span>
              <span className="flex items-center gap-1 ml-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to Bottom Pill */}
      {showScrollBottom && (
        <button
          type="button"
          onClick={() => {
            isNearBottomRef.current = true;
            setUnreadWhileScrolled(0);
            scrollToBottom(true);
          }}
          className="absolute bottom-20 right-5 z-20 px-3 py-1.5 rounded-full bg-amber-400 text-neutral-950 font-black text-[10px] uppercase tracking-wider shadow-xl flex items-center gap-1 cursor-pointer hover:bg-amber-300"
        >
          <ArrowDown size={12} />
          {unreadWhileScrolled > 0 ? `${unreadWhileScrolled} New` : 'Latest'}
        </button>
      )}

      {/* Input Field Bar */}
      <form onSubmit={handleSend} className="p-3 bg-[#1f2c34] border-t border-[#2a3942] flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => {
            setComposerError(null);
            setShowChallengeComposer((v) => !v);
          }}
          className="p-2.5 rounded-full bg-amber-400/15 hover:bg-amber-400/25 text-amber-400 border border-amber-400/30 transition-all cursor-pointer shrink-0"
          title="Set 1v1 Challenge in Chat"
        >
          <Swords size={18} />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder={`Message ${rival.codm_ign}...`}
          className="flex-1 bg-[#2a3942] text-white placeholder-[#8696a0] rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
        />

        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-full transition-all active:scale-95 cursor-pointer shadow-md shrink-0 flex items-center justify-center"
          title="Send message"
        >
          {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>

      {/* In-Chat Stake Payment Modal */}
      <StakePaymentModal
        isOpen={Boolean(stakeModalMatch)}
        match={stakeModalMatch}
        currentUser={currentUser}
        role="opponent"
        onClose={() => setStakeModalMatch(null)}
        onConfirmStake={handleConfirmInChatStake}
      />
    </div>
  );
};
