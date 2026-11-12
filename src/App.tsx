import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { io } from 'socket.io-client';
import { UserProfile, Match } from './types';
import {
  fetchUser, fetchMatches, fetchMatch, createMatch, joinMatch, squadJoinMatch, squadLeaveMatch,
  opponentStakeMatch, creatorStakeMatch,
  cancelMatch, abandonMatch, submitMatchResult,
  createUser, signUpUser, signInUser, updateUser, withdrawWallet,
  cleanUserHistory, fetchMaintenanceStatus
} from './services/api';

import {
  initNotificationService,
  showBrowserNotification,
  NotificationPayload,
} from './services/notificationService';
import { playShotgunSound } from './hooks/useSound';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';
import { CoreArena } from './components/CoreArena';
import { RulesPage } from './components/RulesPage';
import { HistoryPage } from './components/HistoryPage';
import { ProfilePage } from './components/ProfilePage';
import { CreateBetModal } from './components/CreateBetModal';
import { OpponentOnboardingModal } from './components/OpponentOnboardingModal';
import { FundWalletModal } from './components/FundWalletModal';
import { ReferralPage } from './components/ReferralPage';
import { WalletPage } from './components/WalletPage';
import { AdminDashboard } from './components/AdminDashboard';
import { NotificationToast } from './components/NotificationToast';
import { NotificationCenterModal } from './components/NotificationCenterModal';
import { MatchCreatedSuccessModal } from './components/MatchCreatedSuccessModal';
import { BackgroundUploadBanner } from './components/BackgroundUploadBanner';
import { DisputesPage } from './components/DisputesPage';
import { SocialTab } from './components/SocialTab';
import { SupportPage } from './components/SupportPage';
import { GlobalBroadcastBanner } from './components/GlobalBroadcastBanner';
import { ShieldAlert, UserCheck, Lock, RefreshCw, Users as UsersIcon } from 'lucide-react';

const socket = io('/');

function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();

  const [globalUploading, setGlobalUploading] = useState<boolean>(() => {
    return localStorage.getItem('codm_global_uploading') === 'true';
  });
  const [globalProgress, setGlobalProgress] = useState<number>(() => {
    const saved = localStorage.getItem('codm_global_progress');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [globalUploadStatus, setGlobalUploadStatus] = useState<'idle' | 'uploading' | 'pending_review' | 'failed'>(() => {
    return (localStorage.getItem('codm_global_upload_status') as any) || 'idle';
  });

  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'guest',
    username: 'Gamer',
    codmIgn: 'CODM_Gamer',
    codmUid: '0000000000000000',
    email: '',
    phone: '',
    balance: 0,
    escrowBalance: 0,
    totalWinnings: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=CODM_Gamer',
    transactions: [],
  });
  const [matches, setMatches] = useState<Match[]>([]);
  const [notifications, setNotifications] = useState<NotificationPayload[]>(() => {
    try {
      const saved = localStorage.getItem('codm_notifications_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeToast, setActiveToast] = useState<NotificationPayload | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('codm_notifications_unread');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const previousMatchesRef = useRef<Map<string, string>>(new Map());

  // Initialize browser notification service worker on mount
  useEffect(() => {
    initNotificationService();
  }, []);

  const speakChatMessage = useCallback((text: string, senderName: string) => {
    try {
      const utterance = new SpeechSynthesisUtterance(`${senderName} says: ${text}`);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // fallback
    }
  }, []);

  // Centralized alert dispatcher (vibrates phone, plays chime, shows lock-screen notification + toast)
  const triggerNotificationAlert = useCallback((payload: NotificationPayload) => {
    showBrowserNotification(payload);
    setActiveToast(payload);
    
    // Play custom tactical shotgun sound for all incoming alerts
    playShotgunSound();

    setNotifications((prev) => {
      const filtered = prev.filter((n) => n.id !== payload.id);
      const updated = [payload, ...filtered].slice(0, 30);
      try {
        localStorage.setItem('codm_notifications_history', JSON.stringify(updated));
      } catch {
        // storage quota fallback
      }
      return updated;
    });

    setUnreadCount((prev) => {
      const next = prev + 1;
      try {
        localStorage.setItem('codm_notifications_unread', next.toString());
      } catch {
        // storage fallback
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const data = await fetchMaintenanceStatus();
        setMaintenanceActive(data.maintenanceMode);
      } catch (e) {
        console.error('Failed to check maintenance status:', e);
      }
    };
    checkMaintenance();
    const interval = setInterval(checkMaintenance, 30000); // Check every 30 seconds for faster updates
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    socket.on('matchCreated', (newMatch) => {
      if (!newMatch || !newMatch.id) return;
      setMatches((prev) => {
        if (prev.some((m) => m.id === newMatch.id)) return prev;
        return [newMatch, ...prev];
      });

      // Send push notification if new live match is awaiting opponent (for other players)
      if (
        newMatch.creator?.id !== currentUser.id &&
        (newMatch.status === 'PENDING_OPPONENT_STAKE' || newMatch.status === 'PENDING')
      ) {
        triggerNotificationAlert({
          id: `notif_new_match_${newMatch.id}_${Date.now()}`,
          title: `⚔️ New Match Open: ₦${Number(newMatch.stakeAmount || 0).toLocaleString()} Challenge!`,
          body: `${newMatch.creator?.codmIgn || 'A gladiator'} is awaiting an opponent for 1v1 ${newMatch.gameMode || 'Multiplayer'} on ${newMatch.map || 'Shipment'}. Tap to accept!`,
          soundType: 'rival_joined',
          data: { matchId: newMatch.id, url: '/arena' },
        });
      }
    });

    // Direct match alert event broadcast from server
    socket.on('matchAlert', (alert: any) => {
      if (!alert) return;

      // Filter out self-notifications for match creation (creator already knows they created it)
      if (
        (alert.status === 'PENDING_OPPONENT_STAKE' || alert.status === 'PENDING') &&
        alert.creatorId === currentUser.id
      ) {
        return;
      }

      const isRelated =
        currentUser.id === 'guest' ||
        alert.creatorId === currentUser.id ||
        alert.opponentId === currentUser.id ||
        alert.status === 'PENDING_OPPONENT_STAKE' ||
        alert.status === 'PENDING' ||
        alert.matchId;

      if (!isRelated) return;

      triggerNotificationAlert({
        id: alert.id || `alert_${Date.now()}`,
        title: alert.title,
        body: alert.body,
        soundType: alert.soundType || 'default',
        data: {
          matchId: alert.matchId,
          url: '/arena',
          status: alert.status,
        },
      });
    });

    // Real-time chat notification when players in the same match room send messages
    socket.on('chatNotification', (chatAlert: any) => {
      if (!chatAlert || !chatAlert.text) return;
      if (chatAlert.senderId === currentUser.id) return; // Do not notify sender

      triggerNotificationAlert({
        id: chatAlert.id || `chat_alert_${Date.now()}`,
        title: `💬 ${chatAlert.senderName} (Match Chat)`,
        body: chatAlert.text,
        soundType: 'default',
        tag: `codm_chat_${chatAlert.matchId}`,
        data: {
          matchId: chatAlert.matchId,
          url: '/arena',
        },
      });
      
      // Speak out the message if app is minimized or user is on another page
      if (location.pathname !== '/arena' || !document.hasFocus()) {
        speakChatMessage(chatAlert.text, chatAlert.senderName);
      }
    });

    socket.on('matchUpdated', (updatedMatch: Match) => {
      if (!updatedMatch || !updatedMatch.id) return;

      const prevStatus = previousMatchesRef.current.get(updatedMatch.id);
      previousMatchesRef.current.set(updatedMatch.id, updatedMatch.status);

      const isCreator = updatedMatch.creator?.id === currentUser.id;
      const isOpponent = updatedMatch.opponent?.id === currentUser.id;
      const isMyMatch = isCreator || isOpponent || currentUser.id === 'guest';

      // Detect meaningful match state changes
      if (prevStatus && prevStatus !== updatedMatch.status && isMyMatch) {
        // 1. Rival Joined (Creator gets notified when opponent stakes)
        if (
          isCreator &&
          updatedMatch.status === 'OPPONENT_STAKED_AWAITING_CREATOR' &&
          prevStatus === 'PENDING_OPPONENT_STAKE'
        ) {
          triggerNotificationAlert({
            id: `alert_rival_${updatedMatch.id}_${Date.now()}`,
            title: `⚔️ Rival Joined Challenge #${updatedMatch.challengeCode}!`,
            body: `${updatedMatch.opponent?.codmIgn || 'An opponent'} staked ₦${updatedMatch.stakeAmount.toLocaleString()} in escrow! Match stake to battle.`,
            soundType: 'rival_joined',
            data: { matchId: updatedMatch.id, url: '/arena' },
          });
        }
        // 2. Match Started (Room Code generated, ready to play)
        else if (
          (updatedMatch.status === 'READY_TO_PLAY' || updatedMatch.status === 'IN_PROGRESS') &&
          prevStatus !== 'READY_TO_PLAY' &&
          prevStatus !== 'IN_PROGRESS'
        ) {
          triggerNotificationAlert({
            id: `alert_start_${updatedMatch.id}_${Date.now()}`,
            title: `🔥 Match Started! Room Code #${updatedMatch.roomCode || 'Ready'}`,
            body: `Both stakes locked (Pot: ₦${updatedMatch.potAmount.toLocaleString()}). Join CODM Room #${updatedMatch.roomCode} now!`,
            soundType: 'match_started',
            data: { matchId: updatedMatch.id, url: '/arena' },
          });
        }
        // 3. Result Disputed
        else if (updatedMatch.status === 'DISPUTED') {
          triggerNotificationAlert({
            id: `alert_disp_${updatedMatch.id}_${Date.now()}`,
            title: `⚠️ Result Disputed on Match #${updatedMatch.challengeCode}`,
            body: `Conflicting scores reported. Escrow is protected under referee review. Upload post-match screenshot!`,
            soundType: 'disputed',
            data: { matchId: updatedMatch.id, url: '/arena' },
          });
        }
        // 4. Match Settled
        else if (updatedMatch.status === 'SETTLED') {
          const isWinner = updatedMatch.winnerId === currentUser.id;
          triggerNotificationAlert({
            id: `alert_settle_${updatedMatch.id}_${Date.now()}`,
            title: isWinner ? `🏆 Victory! ₦${updatedMatch.winnerPayout.toLocaleString()} Won` : `💀 Match Settled`,
            body: isWinner
              ? `Congratulations! Winnings credited to your wallet balance.`
              : `Match #${updatedMatch.challengeCode} has concluded. Winner: ${updatedMatch.winnerIgn || 'Champion'}.`,
            soundType: isWinner ? 'settled' : 'default',
            data: { matchId: updatedMatch.id, url: '/arena' },
          });
        }
      }

      setMatches((prev) => prev.map((m) => m.id === updatedMatch.id ? updatedMatch : m));
    });
    
    socket.on('matchJoined', (updatedMatch) => {
      if (!updatedMatch || !updatedMatch.id) return;
      setMatches((prev) => prev.map((m) => m.id === updatedMatch.id ? updatedMatch : m));
    });
    
    socket.on('balanceUpdated', (updatedUser) => {
      if (updatedUser && updatedUser.id === currentUser.id) {
        setCurrentUser(updatedUser);
      }
    });

    socket.on('userUpdated', (updatedUser) => {
      if (updatedUser && updatedUser.id === currentUser.id) {
        setCurrentUser(updatedUser);
      }
    });

    socket.on('telegramLinked', (payload: any) => {
      if (payload && payload.userId === currentUser.id) {
        const tgHandle = payload.telegramUsername || payload.username;
        triggerNotificationAlert({
          id: `alert_tg_${Date.now()}`,
          title: '🤖 Telegram Bot Linked Successfully!',
          body: tgHandle
            ? `@${tgHandle} is connected. You'll now receive instant battle wagers and escrow payout alerts!`
            : 'Your Telegram account is connected. Instant battle notifications active!',
          soundType: 'match_started',
          data: { url: '/profile' },
        });
        // Refresh full user state
        fetchUser(currentUser.id).then((fresh) => {
          if (fresh && fresh.id) setCurrentUser(fresh);
        }).catch(() => {});
      }
    });

    // Real-time Push Notification handler for Rival requests & accepted requests
    const handleRivalNotification = (alert: any) => {
      if (!alert) return;
      if (alert.targetUserId && alert.targetUserId !== currentUser.id) return;

      triggerNotificationAlert({
        id: alert.id || `rival_alert_${Date.now()}`,
        title: alert.title || '⚔️ Rival Request Accepted!',
        body: alert.body || 'Your rival request was accepted! Tap to chat or set up a 1v1 wager.',
        soundType: alert.soundType || 'rival_joined',
        data: alert.data || { url: '/social' },
      });
    };

    socket.on('rivalNotification', handleRivalNotification);

    const directRivalEvent = `rival_accepted_${currentUser.id}`;
    const handleDirectRivalAccepted = (data: any) => {
      triggerNotificationAlert({
        id: `rival_accepted_${Date.now()}`,
        title: data.title || '⚔️ Rival Request Accepted!',
        body: data.body || `${data.rivalIgn || 'A player'} accepted your rival request! Tap to chat or set up a 1v1 wager.`,
        soundType: 'rival_joined',
        data: { url: '/social', rivalId: data.rivalId },
      });
    };

    if (currentUser.id && currentUser.id !== 'guest') {
      socket.on(directRivalEvent, handleDirectRivalAccepted);
    }
    
    return () => {
      socket.off('matchCreated');
      socket.off('matchAlert');
      socket.off('globalChatAlert');
      socket.off('matchUpdated');
      socket.off('matchJoined');
      socket.off('balanceUpdated');
      socket.off('userUpdated');
      socket.off('telegramLinked');
      socket.off('rivalNotification', handleRivalNotification);
      if (currentUser.id && currentUser.id !== 'guest') {
        socket.off(directRivalEvent, handleDirectRivalAccepted);
      }
    };
  }, [currentUser.id, triggerNotificationAlert]);
  const [isMatchesLoading, setIsMatchesLoading] = useState<boolean>(true);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  // Modals & configuration
  const [isCreateBetOpen, setIsCreateBetOpen] = useState(false);
  const [createBetInitialMode, setCreateBetInitialMode] = useState<string | undefined>(undefined);
  const [createBetInitialStake, setCreateBetInitialStake] = useState<number | undefined>(undefined);
  const [createBetInitialRivalId, setCreateBetInitialRivalId] = useState<string | undefined>(undefined);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
  const [onboardingTargetMatch, setOnboardingTargetMatch] = useState<Match | null>(null);
  const [isFundWalletModalOpen, setIsFundWalletModalOpen] = useState(false);
  const [createdMatchSuccess, setCreatedMatchSuccess] = useState<Match | null>(null);

  // Determine current tab from pathname
  const pathname = location.pathname;
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  const joinMatchId = urlParams.get('join');

  let currentTab = 'landing';
  if (pathname === '/auth' || (pathname === '/' && refCode && currentUser.id === 'guest')) currentTab = 'auth';
  else if (pathname === '/arena' || (pathname === '/' && currentUser.id !== 'guest' && !refCode)) currentTab = 'arena';
  else if (pathname === '/rules') currentTab = 'rules';
  else if (pathname === '/history') currentTab = 'history';
  else if (pathname === '/disputes') currentTab = 'disputes';
  else if (pathname === '/referrals') currentTab = 'referrals';
  else if (pathname === '/wallet') currentTab = 'wallet';
  else if (pathname === '/profile') currentTab = 'profile';
  else if (pathname === '/social') currentTab = 'social';
  else if (pathname === '/support') currentTab = 'support';
  else if (pathname === '/msksksnuwje') currentTab = 'admin';

  // Initial Data Fetch & URL Deep Link Check
  useEffect(() => {
    loadInitialSessionAndData();

    if (refCode && currentUser.id === 'guest') {
      setAuthMode('signup');
      if (pathname === '/') {
        navigate(`/auth?ref=${encodeURIComponent(refCode)}`, { replace: true });
      }
    } else if (joinMatchId) {
      handleDeepLinkJoin(joinMatchId);
    }
  }, []);

  const loadInitialSessionAndData = async () => {
    try {
      const savedUserId = localStorage.getItem('codm_current_user_id');
      if (savedUserId) {
        try {
          const activeUser = await fetchUser(savedUserId);
          if (activeUser && activeUser.id) {
            setCurrentUser(activeUser);
          }
        } catch (e: any) {
          console.error('Could not load saved user:', e);
          // ONLY clear session if it's a 401/404. If it's a 503 (Maintenance), KEEP the session
          // so admins can still bypass once they reach the arena or dashboard.
          const errorMsg = String(e.message || '');
          if (!errorMsg.includes('System Maintenance') && !errorMsg.includes('503')) {
            localStorage.removeItem('codm_current_user_id');
          }
        }
      }
      const mList = await fetchMatches();
      setMatches(mList);
      setIsMatchesLoading(false);
    } catch (e) {
      console.error('Initial data load error:', e);
      setIsMatchesLoading(false);
    }
  };

  const loadData = async (userToFetchId?: string) => {
    try {
      const uid = userToFetchId || currentUser.id;
      const u = await fetchUser(uid);
      setCurrentUser(u);
      setIsMatchesLoading(true);
      const mList = await fetchMatches();
      setMatches(mList);
      setIsMatchesLoading(false);
    } catch (e) {
      console.error(e);
      setIsMatchesLoading(false);
    }
  };

  const handleDeepLinkJoin = async (matchId: string) => {
    try {
      const match = await fetchMatch(matchId);
      if (match && match.status === 'PENDING_OPPONENT_STAKE') {
        setOnboardingTargetMatch(match);
        setIsOnboardingModalOpen(true);
      } else if (match) {
        navigate('/arena');
      }
    } catch (err) {
      console.error('Deep link match lookup error:', err);
    }
  };

  const handleOpenCreateBet = (mode?: string, stake?: number, rivalId?: string) => {
    setCreateBetInitialMode(mode);
    setCreateBetInitialStake(stake);
    setCreateBetInitialRivalId(rivalId);
    setIsCreateBetOpen(true);
  };

  const handleCreateBet = async (data: {
    stakeAmount: number;
    gameMode: string;
    map: string;
    rules: string[];
    matchDurationMinutes?: number;
    isPublic?: boolean;
    matchType?: 'solo' | 'squad';
  }) => {
    const newMatch = await createMatch({
      creatorId: currentUser.id,
      stakeAmount: data.stakeAmount,
      gameMode: data.gameMode,
      map: data.map,
      rules: data.rules,
      matchDurationMinutes: data.matchDurationMinutes,
      isPublic: data.isPublic,
      matchType: data.matchType || 'solo',
    });

    if (newMatch && newMatch.id) {
      // 1. Immediately update matches list in UI (0ms delay!)
      setMatches((prev) => [newMatch, ...prev.filter((m) => m.id !== newMatch.id)]);

      // 2. Immediately deduct user wallet balance and credit escrow locally
      setCurrentUser((prev) => ({
        ...prev,
        balance: Math.max(0, prev.balance - data.stakeAmount),
        escrowBalance: prev.escrowBalance + data.stakeAmount,
      }));

      // 3. Real-time alert notification showing exact payout amount
      const isSquad = (data.matchType === 'squad') || (newMatch.matchType === 'squad');
      const payoutText = isSquad
        ? `5v5 Squad Created! Exact Payout: ₦${newMatch.winnerPayout.toLocaleString()} per winning player (₦${((newMatch.winnerPayout || 0) * 5).toLocaleString()} Team Prize Pool)`
        : `1v1 Match Created! Winner Payout: ₦${newMatch.winnerPayout.toLocaleString()}`;

      triggerNotificationAlert({
        id: `match_created_${newMatch.id}`,
        title: isSquad ? `🛡️ 5v5 Squad Wager Created!` : `⚔️ 1v1 Challenge Created!`,
        body: payoutText,
        soundType: 'default',
        data: { matchId: newMatch.id, url: '/arena' },
      });

      // 4. Immediately close creation input modal, open payout success modal, and navigate to Arena view
      setIsCreateBetOpen(false);
      setCreateBetInitialMode(undefined);
      setCreateBetInitialStake(undefined);
      setCreatedMatchSuccess(newMatch);
      navigate('/arena');

      // 5. Parallel background sync without blocking UI or showing full page loading spinners
      fetchUser(currentUser.id).then((u) => u && u.id && setCurrentUser(u)).catch(() => {});
      fetchMatches().then((mList) => mList && setMatches(mList)).catch(() => {});
    }
  };

  const handleJoinMatch = async (matchId: string, opponentId: string) => {
    try {
      await joinMatch(matchId, opponentId);
      setIsCreateBetOpen(false);
      navigate('/arena');

      // Parallel background sync
      fetchUser(currentUser.id).then((u) => u && u.id && setCurrentUser(u)).catch(() => {});
      fetchMatches().then((mList) => mList && setMatches(mList)).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to join match');
    }
  };

  const handleSquadJoin = async (matchId: string, slotIndex?: number, team?: 'ALPHA' | 'BRAVO') => {

    try {
      const updatedMatch = await squadJoinMatch(matchId, {
        userId: currentUser.id,
        slotIndex,
        team,
      });
      if (updatedMatch && updatedMatch.id) {
        setMatches((prev) => prev.map((m) => m.id === updatedMatch.id ? updatedMatch : m));
      }
      fetchUser(currentUser.id).then((u) => u && u.id && setCurrentUser(u)).catch(() => {});
      fetchMatches().then((mList) => mList && setMatches(mList)).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to join squad slot');
    }
  };

  const handleSquadLeave = async (matchId: string) => {
    try {
      const updatedMatch = await squadLeaveMatch(matchId, currentUser.id);
      if (updatedMatch && updatedMatch.id) {
        setMatches((prev) => prev.map((m) => m.id === updatedMatch.id ? updatedMatch : m));
      }
      fetchUser(currentUser.id).then((u) => u && u.id && setCurrentUser(u)).catch(() => {});
      fetchMatches().then((mList) => mList && setMatches(mList)).catch(() => {});
    } catch (err: any) {
      alert(err.message || 'Failed to leave squad slot');
    }
  };


  const handleOpponentStake = async (
    matchId: string,
    paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance' | 'flutterwave'
  ) => {
    await opponentStakeMatch(matchId, {
      opponentId: currentUser.id,
      paymentMethod,
    });
    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
  };

  const handleCreatorStake = async (
    matchId: string,
    paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance' | 'flutterwave'
  ) => {
    await creatorStakeMatch(matchId, {
      creatorId: currentUser.id,
      paymentMethod,
    });
    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
  };

  const handleSimulateOpponentStake = async (matchId: string) => {
    await loadData();
  };

  const handleCompleteOnboarding = async (userData: {
    codmIgn: string;
    codmUid?: string;
    email: string;
    phone: string;
    initialDeposit?: number;
  }) => {
    const newUser = await createUser({
      ...userData,
      initialDeposit: userData.initialDeposit || 0,
    });

    setCurrentUser(newUser);
    localStorage.setItem('codm_current_user_id', newUser.id);
    await loadData();
    setOnboardingTargetMatch(null);
    navigate('/arena');
  };

  const handleSubmitResult = async (matchId: string, claim: 'VICTORY' | 'DEFEAT' | 'DRAW', screenshotBase64?: string) => {
    await submitMatchResult(matchId, {
      playerId: currentUser.id,
      claim,
      screenshotBase64,
    });
    const updatedUser = await fetchUser(currentUser.id);
    setCurrentUser(updatedUser);
    await loadData();
  };

  const handleCancelMatch = async (matchId: string) => {
    console.log('Attempting to cancel match:', matchId);
    try {
      await cancelMatch(matchId);
      console.log('Match cancellation request successful');
      const updatedUser = await fetchUser(currentUser.id);
      setCurrentUser(updatedUser);
      await loadData();
    } catch (err: any) {
      console.error('Match cancellation failed:', err);
      alert(err.message || 'Failed to cancel match');
    }
  };

  const handleAbandonMatch = async (matchId: string, reason?: string) => {
    try {
      const res = await abandonMatch(matchId, reason);
      const updatedUser = await fetchUser(currentUser.id);
      setCurrentUser(updatedUser);
      await loadData();
      return res;
    } catch (err: any) {
      console.error('Match abandonment failed:', err);
      alert(err.message || 'Failed to settle abandoned match');
      throw err;
    }
  };

  const handleSignUp = async (data: {
    email: string;
    password: string;
    codmIgn: string;
    codmUid: string;
    phone: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    initialDeposit: number;
    verificationCode: string;
    referralCode?: string;
  }) => {
    const user = await signUpUser(data);
    localStorage.setItem('codm_current_user_id', user.id);
    setCurrentUser(user);
    await loadData(user.id);
    navigate('/arena');
  };

  const handleSignIn = async (data: {
    identifier: string;
    password: string;
  }) => {
    const user = await signInUser(data);
    localStorage.setItem('codm_current_user_id', user.id);
    setCurrentUser(user);
    await loadData(user.id);
    navigate('/arena');
  };

  const handleSignOut = () => {
    localStorage.removeItem('codm_current_user_id');
    setCurrentUser({
      id: 'guest',
      username: 'Gamer',
      codmIgn: 'CODM_Gamer',
      codmUid: '0000000000000000',
      email: '',
      phone: '',
      balance: 0,
      escrowBalance: 0,
      totalWinnings: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=CODM_Gamer',
      transactions: [],
    });
    navigate('/');
  };

  const handleUpdateUser = async (updatedData: Partial<UserProfile>) => {
    try {
      const saved = await updateUser(currentUser.id, updatedData);
      setCurrentUser(saved);
    } catch (err) {
      const updated = { ...currentUser, ...updatedData };
      setCurrentUser(updated);
    }
  };

  const handleCashOut = async (
    amount: number,
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      gateway?: 'flutterwave' | 'paystack';
    }
  ) => {
    try {
      const res = await withdrawWallet(currentUser.id, amount, bankDetails);
      // Immediately deduct balance and update bank details in local state
      if (res && res.balance !== undefined) {
        setCurrentUser(prev => ({
          ...prev,
          balance: res.balance,
          bankName: bankDetails.bankName || prev.bankName,
          accountNumber: bankDetails.accountNumber || prev.accountNumber,
          accountName: bankDetails.accountName || prev.accountName,
          transactions: res.transaction ? [res.transaction, ...(prev.transactions || [])] : prev.transactions,
        }));
      }
      const updatedUser = await fetchUser(currentUser.id);
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }
    } catch (err: any) {
      throw err;
    }
  };

  const handleCleanHistory = async (clearAll: boolean = false) => {
    try {
      const refreshed = await cleanUserHistory(currentUser.id, clearAll);
      if (refreshed) {
        setCurrentUser(refreshed);
      }
    } catch (err: any) {
      console.error('Failed to clean history:', err);
      throw err;
    }
  };

  const handleNavigate = (tab: string) => {
    if (tab === 'landing') navigate('/');
    else if (tab === 'admin') navigate('/msksksnuwje');
    else navigate(`/${tab}`);
  };

  // 1. STANDALONE SEPARATED LANDING PAGE VIEW
  if (currentTab === 'landing') {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-tactical-grid selection:bg-amber-500 selection:text-black">
        <GlobalBroadcastBanner />
        <LandingPage
          matches={matches}
          currentUser={currentUser}
          maintenanceMode={maintenanceActive}
          onOpenAuth={(mode) => {
            setAuthMode(mode || 'signup');
            navigate('/auth');
          }}
          onNavigateToArena={() => navigate('/arena')}
          onNavigateToSupport={() => navigate('/support')}
        />
      </div>
    );
  }

  // 2. AUTHENTICATION PAGE VIEW
  if (currentTab === 'auth') {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-tactical-grid selection:bg-amber-500 selection:text-black">
        <GlobalBroadcastBanner />
        <AuthPage
          initialMode={authMode}
          initialReferralCode={refCode || undefined}
          onSignUp={handleSignUp}
          onSignIn={handleSignIn}
          onBackToLanding={() => {
            window.history.replaceState({}, '', '/');
            navigate('/');
          }}
          demoUsers={{}}
        />
      </div>
    );
  }

  // 3. IN-APP PAGES WITH ROUTING & NAVBAR / BOTTOM DOCK
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-tactical-grid selection:bg-amber-500 selection:text-black relative">
      <GlobalBroadcastBanner />
      <BackgroundUploadBanner
        isUploading={globalUploading}
        progress={globalProgress}
        status={globalUploadStatus}
        isAdminOrModerator={currentUser.role === 'admin' || currentUser.role === 'moderator'}
        onDismiss={() => {
          setGlobalUploadStatus('idle');
          localStorage.setItem('codm_global_upload_status', 'idle');
        }}
      />
      <Navbar
        currentUser={currentUser}
        currentTab={currentTab}
        onNavigate={handleNavigate}
        openCreateBetModal={() => handleOpenCreateBet()}
        onOpenFundWallet={() => setIsFundWalletModalOpen(true)}
        onSignOut={handleSignOut}
        unreadNotificationsCount={unreadCount}
        onOpenNotificationCenter={() => {
          setIsNotificationCenterOpen(true);
          setUnreadCount(0);
          try {
            localStorage.setItem('codm_notifications_unread', '0');
          } catch {
            // storage fallback
          }
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        <Routes>
          <Route
            path="/arena"
            element={
              maintenanceActive && !['admin', 'super_admin', 'moderator'].includes(currentUser.role || '') ? (
                <MaintenanceOverlay />
              ) : (
                <CoreArena
                  currentUser={currentUser}
                  matches={matches}
                  isMatchesLoading={isMatchesLoading}
                  onCreateBet={handleCreateBet}
                  onJoinMatch={handleJoinMatch}
                  onOpponentStake={handleOpponentStake}
                  onCreatorStake={handleCreatorStake}
                  onSimulateOpponentStake={handleSimulateOpponentStake}
                  onSubmitResult={handleSubmitResult}
                  onCancelMatch={handleCancelMatch}
                  onAbandonMatch={handleAbandonMatch}
                  onCashOut={handleCashOut}
                  onRefresh={loadData}
                  onOpenCreateBet={handleOpenCreateBet}
                  onOpenNewUserOnboarding={(targetMatch) => {
                    setOnboardingTargetMatch(targetMatch || null);
                    setIsOnboardingModalOpen(true);
                  }}
                  onDismissMatch={(matchId) => {
                    setMatches(matches.filter(m => m.id !== matchId));
                  }}
                />
              )
            }
          />
          <Route
            path="/rules"
            element={
              <RulesPage
                onOpenCreateBet={handleOpenCreateBet}
                onNavigateToArena={() => navigate('/arena')}
              />
            }
          />
          <Route
            path="/history"
            element={
              <HistoryPage
                currentUser={currentUser}
                matches={matches}
                isMatchesLoading={isMatchesLoading}
                onNavigateToArena={() => navigate('/arena')}
                onOpenCreateBet={handleOpenCreateBet}
              />
            }
          />
          <Route
            path="/profile"
            element={
              <ProfilePage
                currentUser={currentUser}
                matches={matches}
                onUpdateUser={handleUpdateUser}
                onCashOut={handleCashOut}
                onNavigateToArena={() => navigate('/arena')}
                onNavigateToHistory={() => navigate('/history')}
                onNavigateToRules={() => navigate('/rules')}
                onNavigateToReferrals={() => navigate('/referrals')}
                onOpenCreateBet={handleOpenCreateBet}
                onSignOut={handleSignOut}
              />
            }
          />
          <Route
            path="/disputes"
            element={
              maintenanceActive && !['admin', 'super_admin', 'moderator'].includes(currentUser.role || '') ? (
                <MaintenanceOverlay />
              ) : (
                <DisputesPage
                  currentUser={currentUser}
                  matches={matches}
                  onRefresh={loadData}
                />
              )
            }
          />
          <Route
            path="/referrals"
            element={
              maintenanceActive && !['admin', 'super_admin', 'moderator'].includes(currentUser.role || '') ? (
                <MaintenanceOverlay />
              ) : (
                <ReferralPage
                  currentUser={currentUser}
                  onNavigateBack={() => navigate('/profile')}
                />
              )
            }
          />
          <Route
            path="/social"
            element={
              maintenanceActive && !['admin', 'super_admin', 'moderator'].includes(currentUser.role || '') ? (
                <MaintenanceOverlay />
              ) : (
                <SocialTab currentUser={currentUser} onOpenCreateBet={handleOpenCreateBet} />
              )
            }
          />
          <Route
            path="/support"
            element={
              maintenanceActive && !['admin', 'super_admin', 'moderator'].includes(currentUser.role || '') ? (
                <MaintenanceOverlay />
              ) : (
                <SupportPage currentUser={currentUser} />
              )
            }
          />
          <Route
            path="/wallet"
            element={
              maintenanceActive && !['admin', 'super_admin', 'moderator'].includes(currentUser.role || '') ? (
                <MaintenanceOverlay />
              ) : (
                <WalletPage
                  currentUser={currentUser}
                  onUpdateUser={handleUpdateUser}
                  onCashOut={handleCashOut}
                  onCleanHistory={handleCleanHistory}
                />
              )
            }
          />
          <Route
            path="/msksksnuwje"
            element={
              <AdminDashboard
                currentUser={currentUser}
                onRefreshUser={async () => {
                  try {
                    const updated = await fetchUser(currentUser.id);
                    setCurrentUser(updated);
                  } catch (e) {
                    console.error('Error refreshing admin profile:', e);
                  }
                }}
              />
            }
          />
          <Route
            path="*"
            element={
              <CoreArena
                currentUser={currentUser}
                matches={matches}
                onCreateBet={handleCreateBet}
                onJoinMatch={handleJoinMatch}
                onSquadJoin={handleSquadJoin}
                onSquadLeave={handleSquadLeave}
                onOpponentStake={handleOpponentStake}

                onCreatorStake={handleCreatorStake}
                onSimulateOpponentStake={handleSimulateOpponentStake}
                onSubmitResult={handleSubmitResult}
                onCancelMatch={handleCancelMatch}
                onAbandonMatch={handleAbandonMatch}
                onCashOut={handleCashOut}
                onRefresh={loadData}
                onOpenCreateBet={handleOpenCreateBet}
                onOpenNewUserOnboarding={(targetMatch) => {
                  setOnboardingTargetMatch(targetMatch || null);
                  setIsOnboardingModalOpen(true);
                }}
                onDismissMatch={(matchId) => {
                  setMatches(matches.filter(m => m.id !== matchId));
                }}
              />
            }
          />
        </Routes>
      </main>

      <footer className="border-t border-neutral-900 bg-neutral-950 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-white tracking-wider">OPS STAKE</span>
            <span>·</span>
            <span>Tactical Mobile Shooter Esports Escrow Wagering in Nigerian Naira (₦)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-neutral-400">Escrow Protected</span>
            <span>·</span>
            <span>Min Wager: ₦100</span>
            <span>·</span>
            <span>10% Platform Rake</span>
          </div>
        </div>
      </footer>

      <CreateBetModal
        currentUser={currentUser}
        isOpen={isCreateBetOpen}
        initialMode={createBetInitialMode}
        initialStake={createBetInitialStake}
        initialRivalId={createBetInitialRivalId}
        onClose={() => {
          setIsCreateBetOpen(false);
          setCreateBetInitialMode(undefined);
          setCreateBetInitialStake(undefined);
          setCreateBetInitialRivalId(undefined);
        }}
        onSubmit={handleCreateBet}
      />

      {/* Immediate Post-Creation Exact Payout & Squad Economics Modal */}
      <MatchCreatedSuccessModal
        match={createdMatchSuccess}
        isOpen={Boolean(createdMatchSuccess)}
        onClose={() => setCreatedMatchSuccess(null)}
        onOpenMatchRoom={() => {
          setCreatedMatchSuccess(null);
          navigate('/arena');
        }}
      />

      <OpponentOnboardingModal
        match={onboardingTargetMatch}
        isOpen={isOnboardingModalOpen}
        currentUser={currentUser}
        onClose={() => {
          setIsOnboardingModalOpen(false);
          setOnboardingTargetMatch(null);
        }}
        onLoginExisting={async (identifier) => {
          const u = await signInUser({ identifier });
          setCurrentUser(u);
          localStorage.setItem('codm_current_user_id', u.id);
          await loadData(u.id);
          if (onboardingTargetMatch) {
            await joinMatch(onboardingTargetMatch.id, u.id);
            await loadData(u.id);
          }
          setIsOnboardingModalOpen(false);
          setOnboardingTargetMatch(null);
          navigate('/arena');
        }}
        onCompleteOnboarding={handleCompleteOnboarding}
      />

      <FundWalletModal
        isOpen={isFundWalletModalOpen}
        currentUser={currentUser}
        onClose={() => setIsFundWalletModalOpen(false)}
        onSuccessDeposit={async () => {
          try {
            const updated = await fetchUser(currentUser.id);
            setCurrentUser(updated);
          } catch (e) {
            console.error('Error refreshing user after deposit:', e);
          }
        }}
      />

      {/* Floating Tactical Alert Toast */}
      <NotificationToast
        notification={activeToast}
        onClose={() => setActiveToast(null)}
        onAction={(url) => {
          if (url) navigate(url);
        }}
      />

      {/* Slide-over Notification Center Modal */}
      <NotificationCenterModal
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        currentUser={currentUser}
        onClearNotifications={() => {
          setNotifications([]);
          try {
            localStorage.removeItem('codm_notifications_history');
          } catch {
            // storage fallback
          }
        }}
        onNavigateToMatch={(url) => {
          if (url) navigate(url);
          setIsNotificationCenterOpen(false);
        }}
      />

    </div>
  );
}

const MaintenanceOverlay: React.FC = () => (
  <div className="fixed inset-0 z-[100] bg-neutral-950 flex items-center justify-center p-6 overflow-hidden">
    <div className="absolute inset-0 bg-tactical-grid opacity-20" />
    <div className="absolute inset-0 bg-gradient-to-b from-rose-500/5 via-transparent to-transparent" />
    
    <div className="relative z-10 max-w-xl w-full text-center space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
        <div className="absolute inset-0 bg-rose-500/20 rounded-[2.5rem] blur-2xl animate-pulse" />
        <div className="relative w-full h-full bg-neutral-900 border-2 border-rose-500/40 rounded-[2.5rem] flex items-center justify-center text-rose-500 shadow-2xl shadow-rose-500/10">
          <ShieldAlert size={64} className="animate-bounce" />
        </div>
      </div>

      <div className="space-y-4">
        <h1 className="text-4xl sm:text-5xl font-black font-heading text-white uppercase tracking-tighter leading-none">
          SYSTEM <span className="text-rose-500">OFFLINE</span>
        </h1>
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-[0.2em]">
          Scheduled Maintenance Protocol Active
        </div>
        <p className="text-neutral-400 text-sm sm:text-base leading-relaxed max-w-md mx-auto font-medium">
          OPS STAKE is currently undergoing critical infrastructure upgrades to enhance your battle experience. Public access is restricted during this phase.
        </p>
      </div>

      <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-3xl space-y-4 shadow-xl">
        <p className="text-xs text-neutral-500 font-mono">Estimated Time Remaining: <span className="text-rose-400 font-bold uppercase animate-pulse">Synchronizing...</span></p>
        <div className="w-full h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div className="w-2/3 h-full bg-rose-500 animate-shimmer" />
        </div>
        <div className="flex items-center justify-center gap-6 pt-2">
          <div className="text-center">
            <div className="text-xl font-black text-white font-mono tracking-tighter">100%</div>
            <div className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Escrow Safe</div>
          </div>
          <div className="w-px h-8 bg-neutral-800" />
          <div className="text-center">
            <div className="text-xl font-black text-white font-mono tracking-tighter">LIVE</div>
            <div className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">Staff Only</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <button
          onClick={() => window.location.href = '/auth?mode=signin'}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-400 border border-amber-500 text-black hover:bg-amber-300 transition-all text-xs font-black uppercase tracking-widest shadow-lg shadow-amber-400/20"
        >
          <UserCheck size={14} />
          <span>Staff Sign In</span>
        </button>
        <button
          onClick={() => window.location.href = '/msksksnuwje'}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-all text-xs font-black uppercase tracking-widest"
        >
          <Lock size={14} />
          <span>Staff Access Portal</span>
        </button>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700 transition-all text-xs font-black uppercase tracking-widest"
        >
          <RefreshCw size={14} />
          <span>Retry Connection</span>
        </button>
      </div>

      <p className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.3em]">
        Handshake Protocol: v2.4.0-Maintenance
      </p>
    </div>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<MainApp />} />
      </Routes>
    </BrowserRouter>
  );
}
