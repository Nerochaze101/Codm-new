import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { UserProfile, Match } from '../types';
import {
  Swords, ShieldCheck, Trophy, Copy, Check, Share2, Upload,
  ArrowRight, AlertCircle, CheckCircle2, MessageCircle, Wallet,
  UserCheck, RefreshCw, Sparkles, Crosshair, Target, X, Plus,
  Flame, Zap, Users, Flag, Shield, Sliders, ChevronRight, Gamepad2, MapPin,
  TrendingUp, Award, Clock, Lock, AlertTriangle, XCircle, Bell, Info, ExternalLink, Send,
  Search, Radio
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { SkeletonLoader } from './SkeletonLoader';
import { StakePaymentModal } from './StakePaymentModal';
import { MatchLobbyChat } from './MatchLobbyChat';
import { requestNotificationPermission, getNotificationPermission, isIOS, isStandalone } from '../services/notificationService';
import { IOSNotificationGuideModal } from './IOSNotificationGuideModal';
import { playShotgunSound } from '../hooks/useSound';
import { VideoTutorial } from './VideoTutorial';
import { uploadMatchVideoWithProgress, fetchActiveRivals } from '../services/api';

const CardBackground = () => (
  <div className="absolute inset-0 z-0 opacity-10">
    <img src={CODM_IMAGES.cardBgSubtle} alt="" className="w-full h-full object-cover" loading="lazy" />
    <div className="absolute inset-0 bg-neutral-900/60" />
  </div>
);

interface CoreArenaProps {
  currentUser: UserProfile;
  matches: Match[];
  isMatchesLoading?: boolean;
  onCreateBet: (data: { stakeAmount: number; gameMode: string; map: string; rules: string[]; matchDurationMinutes?: number; isPublic?: boolean; matchType?: 'solo' | 'squad' }) => Promise<void>;
  onOpenCreateBet?: (mode?: string, stake?: number, rivalId?: string) => void;
  onJoinMatch: (matchId: string, opponentId: string) => Promise<void>;
  onSquadJoin?: (matchId: string, slotIndex?: number, team?: 'ALPHA' | 'BRAVO') => Promise<void>;
  onSquadLeave?: (matchId: string) => Promise<void>;
  onOpponentStake?: (matchId: string, paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance' | 'flutterwave') => Promise<void>;
  onCreatorStake?: (matchId: string, paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance' | 'flutterwave') => Promise<void>;
  onSimulateOpponentStake?: (matchId: string) => Promise<void>;
  onSubmitResult: (matchId: string, claim: 'VICTORY' | 'DEFEAT' | 'DRAW', screenshotBase64?: string) => Promise<void>;
  onCancelMatch: (matchId: string) => Promise<void>;
  onAbandonMatch?: (matchId: string, reason?: string) => Promise<any>;
  onDismissMatch: (matchId: string) => void;
  onOpenWallet?: () => void;
  onRefresh: () => Promise<void>;
  onOpenNewUserOnboarding: (match?: Match) => void;
  onCashOut?: (amount: number, bankDetails: { bankName: string; accountNumber: string; accountName: string; gateway?: 'flutterwave' | 'paystack' }) => Promise<void>;
}

export const CoreArena: React.FC<CoreArenaProps> = ({
  currentUser, matches, isMatchesLoading, onCreateBet, onJoinMatch, onSquadJoin, onSquadLeave, onOpponentStake, onCreatorStake,
  onSubmitResult, onCancelMatch, onAbandonMatch, onDismissMatch, onRefresh, onOpenNewUserOnboarding, onOpenCreateBet, onCashOut
}) => {
  const navigate = useNavigate();

  const [selectedClaim, setSelectedClaim] = useState<'VICTORY' | 'DEFEAT' | 'DRAW'>('VICTORY');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedRivalIgn, setCopiedRivalIgn] = useState(false);
  const [copiedRivalUid, setCopiedRivalUid] = useState(false);
  const [arenaCashoutConfirming, setArenaCashoutConfirming] = useState(false);
  const [isArenaCashoutSubmitting, setIsArenaCashoutSubmitting] = useState(false);
  const [isAbandoning, setIsAbandoning] = useState(false);
  const [showAbandonModal, setShowAbandonModal] = useState(false);
  const [abandonError, setAbandonError] = useState<string | null>(null);
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(true);
  const [showIOSGuideModal, setShowIOSGuideModal] = useState(false);
  const [activeMatchSubTab, setActiveMatchSubTab] = useState<'game' | 'chat'>('game');
  const [searchQuery, setSearchQuery] = useState('');
  const [stakeTargetMatch, setStakeTargetMatch] = useState<Match | null>(null);
  const [stakeRole, setStakeRole] = useState<'opponent' | 'creator'>('opponent');
  const [isStakeModalOpen, setIsStakeModalOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [serverTimeOffset, setServerTimeOffset] = useState<number>(0);
  const [selectedActiveMatchId, setSelectedActiveMatchId] = useState<string | null>(null);
  const [localPendingSubmissions, setLocalPendingSubmissions] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem('codm_local_pending_submissions') || '{}'); } catch { return {}; }
  });

  const [dismissedMatchIds, setDismissedMatchIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('codm_dismissed_matches') || '[]'); } catch { return []; }
  });

  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const [isUploadingVideo, setIsUploadingVideo] = useState<boolean>(false);
  const [videoUploadMatchId, setVideoUploadMatchId] = useState<string | null>(null);
  const [videoUploadStatus, setVideoUploadStatus] = useState<'idle' | 'uploading' | 'pending_review' | 'failed'>('idle');
  const [videoUploadError, setVideoUploadError] = useState<string | null>(null);

  const handleVideoUpload = async (matchId: string, file: File) => {
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      setVideoUploadError('File size exceeds 200MB limit. Please compress or record a shorter clip.');
      return;
    }
    setVideoUploadError(null);
    setIsUploadingVideo(true);
    setVideoUploadMatchId(matchId);
    setVideoUploadProgress(0);
    setVideoUploadStatus('uploading');

    try {
      await uploadMatchVideoWithProgress(
        matchId,
        file,
        currentUser.id,
        currentUser.codmIgn,
        (percent) => {
          setVideoUploadProgress(percent);
        }
      );
      setVideoUploadProgress(100);
      setVideoUploadStatus('pending_review');
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      console.error('Video upload failed:', err);
      setVideoUploadStatus('failed');
      setVideoUploadError('Video upload failed: ' + (err.message || 'Please try again.'));
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const activeStatuses = ['PENDING_OPPONENT_STAKE', 'OPPONENT_STAKED_AWAITING_CREATOR', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'];
  const safeMatches = Array.isArray(matches) ? matches : [];
  const myActiveMatches = safeMatches.filter(m => {
    if (!m || !m.creator || !currentUser) return false;
    const isCreator = m.creator.id === currentUser.id;
    const isOpponent = m.opponent?.id === currentUser.id;
    const isInSquad = m.squadData?.slots?.some(s => s.userId === currentUser.id && s.staked);
    return (isCreator || isOpponent || isInSquad) && activeStatuses.includes(m.status);
  });
  
  const myActiveMatch = selectedActiveMatchId 
    ? myActiveMatches.find(m => m.id === selectedActiveMatchId) || myActiveMatches[0]
    : myActiveMatches[0];

  const [arenaTab, setArenaTab] = useState<'live' | 'active' | 'rivals' | 'hosted'>(() => myActiveMatches.length > 0 ? 'active' : 'live');
  const [activeRivals, setActiveRivals] = useState<any[]>([]);
  const [rivalsLoading, setRivalsLoading] = useState<boolean>(false);
  const [rivalsSearch, setRivalsSearch] = useState<string>('');
  const [rivalsFilter, setRivalsFilter] = useState<'ALL' | 'ONLINE'>('ALL');

  const loadActiveRivals = async () => {
    if (!currentUser?.id || currentUser.id === 'guest') return;
    try {
      setRivalsLoading(true);
      const data = await fetchActiveRivals(currentUser.id);
      setActiveRivals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load active rivals:', err);
    } finally {
      setRivalsLoading(false);
    }
  };

  useEffect(() => {
    if (!currentUser?.id || currentUser.id === 'guest') return;

    loadActiveRivals();

    const socket = io();
    socket.on('rival_presence_update', (data: { userId: string; isOnline: boolean; currentActivity?: string }) => {
      setActiveRivals(prev => prev.map(r => {
        if (r.id === data.userId) {
          return {
            ...r,
            isOnline: data.isOnline,
            currentActivity: data.currentActivity !== undefined ? data.currentActivity : r.currentActivity
          };
        }
        return r;
      }));
    });

    const friendUpdateEvent = `friend_update_${currentUser.id}`;
    socket.on(friendUpdateEvent, () => {
      loadActiveRivals();
    });

    const pollInterval = setInterval(() => {
      fetchActiveRivals(currentUser.id)
        .then(data => {
          if (Array.isArray(data)) setActiveRivals(data);
        })
        .catch(() => {});
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      socket.disconnect();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (myActiveMatches.length > 0 && !selectedActiveMatchId) {
      setSelectedActiveMatchId(myActiveMatches[0].id);
    }
  }, [myActiveMatches.length]);

  useEffect(() => {
    localStorage.setItem('codm_local_pending_submissions', JSON.stringify(localPendingSubmissions));
  }, [localPendingSubmissions]);


  const [showTelegramConnectPopup, setShowTelegramConnectPopup] = useState<boolean>(false);
  const [botUsername, setBotUsername] = useState<string>('OpsSTAKEBOT');
  const [isVerifyingChannel, setIsVerifyingChannel] = useState<boolean>(false);

  useEffect(() => {
    if (currentUser && currentUser.id !== 'guest' && !currentUser.telegramChatId) {
      setShowTelegramConnectPopup(true);
    } else {
      setShowTelegramConnectPopup(false);
    }
  }, [currentUser?.id, currentUser?.telegramChatId]);

  useEffect(() => {
    fetch('/api/telegram/bot-info')
      .then(res => res.json())
      .then(data => {
        if (data.botUsername) setBotUsername(data.botUsername);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/server-time').then(res => res.json()).then(data => setServerTimeOffset(data.serverTime - Date.now())).catch(() => {});
  }, []);

  useEffect(() => {
    if (!myActiveMatch?.roomGeneratedAt || !myActiveMatch?.matchDurationMinutes) return;
    const targetTime = myActiveMatch.roomGeneratedAt + (myActiveMatch.matchDurationMinutes * 60 * 1000);
    const updateTimer = () => {
      const diff = targetTime - (Date.now() + serverTimeOffset);
      if (diff <= 0) { setTimeLeft('00:00'); setIsExpired(true); } 
      else {
        const mins = Math.floor(diff / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        setIsExpired(false);
      }
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [myActiveMatch, serverTimeOffset]);

  useEffect(() => {
    if (myActiveMatch && ['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(myActiveMatch.status)) {
      setArenaTab('active');
      // Play tactical sound when entering an active match room
      playShotgunSound();
    }
  }, [myActiveMatch?.status]);

  useEffect(() => {
    // Play entry sound on mount for the Arena
    const timer = setTimeout(() => {
      playShotgunSound();
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const openChallenges = matches.filter(m => m.status === 'PENDING_OPPONENT_STAKE' && m.isPublic !== false);
  const myHostedBets = matches.filter(m => m.creator.id === currentUser.id && m.status === 'PENDING_OPPONENT_STAKE');
  const isCreatorOfActive = myActiveMatch?.creator.id === currentUser.id;
  const filteredChallenges = openChallenges.filter(m => searchQuery.trim() === '' || m.challengeCode.toUpperCase().includes(searchQuery.trim().toUpperCase()));

  const onlineRivalsCount = activeRivals.filter(r => r.isOnline).length;
  const filteredRivals = activeRivals.filter(r => {
    if (rivalsFilter === 'ONLINE' && !r.isOnline) return false;
    if (!rivalsSearch.trim()) return true;
    const q = rivalsSearch.toLowerCase().trim();
    return (
      (r.codmIgn && r.codmIgn.toLowerCase().includes(q)) ||
      (r.username && r.username.toLowerCase().includes(q))
    );
  });

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };
  const copyInviteLink = (matchId: string) => { navigator.clipboard.writeText(`${window.location.origin}/?join=${matchId}`); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); };
  const copyRivalIgn = (ign: string) => { navigator.clipboard.writeText(ign); setCopiedRivalIgn(true); setTimeout(() => setCopiedRivalIgn(false), 2000); };
  const copyRivalUid = (uid: string) => { navigator.clipboard.writeText(uid); setCopiedRivalUid(true); setTimeout(() => setCopiedRivalUid(false), 2000); };

  const handleResultSubmit = async (matchId: string, directClaim?: 'VICTORY' | 'DEFEAT' | 'DRAW') => {
    const claim = directClaim || selectedClaim;
    const targetMatch = matches.find(m => m.id === matchId);
    if (targetMatch?.status === 'DISPUTED' && !screenshotPreview) { setSubmitError('Screenshot/Video required for dispute.'); return; }
    
    setIsSubmitting(true); 
    setSubmitError(null);
    
    // Set local pending state for "Background Upload" feel
    setLocalPendingSubmissions(prev => ({ ...prev, [matchId]: true }));

    // Non-blocking submission to allow UI interactions and room switching
    (async () => {
      try { 
        await onSubmitResult(matchId, claim, screenshotPreview || undefined); 
        if (targetMatch?.status === 'DISPUTED') setScreenshotPreview(null); 
      } 
      catch (err: any) { 
        setSubmitError(err.message || 'Submission failed'); 
        setLocalPendingSubmissions(prev => {
          const next = { ...prev };
          delete next[matchId];
          return next;
        });
      } 
      finally { 
        setIsSubmitting(false); 
        // Keep in "Uploading/Verifying" state for a few seconds for feedback
        setTimeout(() => {
          setLocalPendingSubmissions(prev => {
            const next = { ...prev };
            delete next[matchId];
            return next;
          });
        }, 8000);
      }
    })();
  };

  const handleConfirmStake = async (method: any) => {
    if (!stakeTargetMatch) return;
    if (stakeRole === 'opponent' && onOpponentStake) await onOpponentStake(stakeTargetMatch.id, method);
    else if (stakeRole === 'creator' && onCreatorStake) await onCreatorStake(stakeTargetMatch.id, method);
    await onRefresh();
  };

  const handleReturnToLobby = async (matchId: string) => {
    const updated = [...dismissedMatchIds, matchId];
    setDismissedMatchIds(updated);
    localStorage.setItem('codm_dismissed_matches', JSON.stringify(updated));
    await onRefresh();
  };

  if (isMatchesLoading) return <div className="max-w-6xl mx-auto space-y-8 pb-16"><SkeletonLoader count={3} /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* 1. Alert Banner */}
      {showNotificationPrompt && typeof window !== 'undefined' && (('Notification' in window && getNotificationPermission() === 'default') || (isIOS() && !isStandalone())) && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 to-neutral-900 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-neutral-950 flex items-center justify-center font-bold shrink-0"><Bell className="w-6 h-6 animate-pulse" /></div>
            <div>
              <div className="text-sm font-bold text-white uppercase tracking-wide">Enable Match Alerts</div>
              <p className="text-xs text-neutral-400">Get notified when a rival joins or match starts.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={async () => { if (isIOS() && !isStandalone()) setShowIOSGuideModal(true); else await requestNotificationPermission(); setShowNotificationPrompt(false); }} className="px-4 py-2 bg-amber-400 text-neutral-950 font-black text-xs uppercase rounded-xl">Enable</button>
            <button onClick={() => setShowNotificationPrompt(false)} className="p-2 text-neutral-500 hover:text-white"><X size={18} /></button>
          </div>
        </div>
      )}

      {/* Background Video Proof Upload Notification Bar */}
      {isUploadingVideo && (
        <div className="p-4 rounded-2xl bg-sky-950/80 border-2 border-sky-500/60 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 animate-bounce" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-white uppercase tracking-wider">
                  Screen Recording Uploading in Background
                </span>
                <span className="text-xs font-mono font-black text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                  {videoUploadProgress}%
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate">
                Dispatching to referee Telegram review group. You can switch tabs or join new battles freely.
              </p>
            </div>
          </div>
          <div className="w-full sm:w-48 bg-neutral-900 h-2.5 rounded-full overflow-hidden shrink-0 border border-sky-500/40">
            <div
              className="h-full bg-gradient-to-r from-sky-500 to-sky-300 transition-all duration-300 shadow-lg"
              style={{ width: `${videoUploadProgress}%` }}
            />
          </div>
        </div>
      )}

      {videoUploadStatus === 'pending_review' && !isUploadingVideo && (
        <div className="p-4 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/60 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-emerald-300 uppercase tracking-wide">
                Video Dispatched to Referee Queue (Pending Review)
              </div>
              <p className="text-[11px] text-neutral-400">
                Your screen recording was sent to referees in Telegram. Funds remain frozen in escrow until review completes.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(currentUser.role === 'admin' || currentUser.role === 'moderator') && (
              <a
                href="https://t.me/+I5vcFF4RXwJkMWVk"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase rounded-xl transition-all shadow"
              >
                Telegram Review Group
              </a>
            )}
            <button
              onClick={() => setVideoUploadStatus('idle')}
              className="p-2 text-neutral-500 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* 2. Tab Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-neutral-900 border border-neutral-800 max-w-2xl mx-auto">
        {(['live', 'active', 'rivals', 'hosted'] as const).map(tab => {
          const isActive = arenaTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setArenaTab(tab)}
              className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 relative ${
                isActive ? 'bg-amber-400 text-neutral-950 shadow-lg scale-[1.02]' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              {tab === 'live' && <Flame size={15} className={isActive ? 'text-neutral-950' : 'text-amber-400'} />}
              {tab === 'active' && <Zap size={15} className={isActive ? 'text-neutral-950' : 'text-amber-400'} />}
              {tab === 'rivals' && <Users size={15} className={isActive ? 'text-neutral-950' : 'text-emerald-400'} />}
              {tab === 'hosted' && <Swords size={15} className={isActive ? 'text-neutral-950' : 'text-amber-400'} />}

              <span className="truncate">
                {tab === 'live' && `Live (${openChallenges.length})`}
                {tab === 'active' && `In Battle ${myActiveMatches.length > 0 ? `(${myActiveMatches.length})` : ''}`}
                {tab === 'rivals' && (
                  <span className="inline-flex items-center gap-1.5">
                    Rivals
                    {onlineRivalsCount > 0 ? (
                      <span className={`inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-neutral-950 text-emerald-400 font-bold' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        {onlineRivalsCount}
                      </span>
                    ) : (
                      `(${activeRivals.length})`
                    )}
                  </span>
                )}
                {tab === 'hosted' && `Hosted (${myHostedBets.length})`}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Live Lobby Tab */}
      {arenaTab === 'live' && (
        <div className="space-y-6">
          {myActiveMatch && (
            <div className={`p-4 rounded-2xl bg-neutral-900 border-2 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in shadow-xl ${
              myActiveMatch.matchType === 'squad' ? 'border-emerald-500/80' : 'border-amber-400'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black shrink-0 ${
                  myActiveMatch.matchType === 'squad' ? 'bg-emerald-400 text-neutral-950' : 'bg-amber-400 text-neutral-950'
                }`}>
                  {myActiveMatch.matchType === 'squad' ? <Users size={20} /> : <Zap size={20} />}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                      {myActiveMatch.matchType === 'squad' ? 'Active 5v5 Squad Battle' : 'Active Battle In Progress'}
                    </span>
                    {myActiveMatch.matchType === 'squad' && (
                      <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                        {(myActiveMatch.squadData?.slots?.filter(s => s.staked).length || 1)}/10 Slots Staked
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-neutral-300 font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Pot: <strong className="text-amber-400">₦{myActiveMatch.potAmount.toLocaleString()}</strong></span>
                    <span>·</span>
                    <span>Fee: <strong className="text-rose-400">₦{(myActiveMatch.platformFee || 0).toLocaleString()} ({myActiveMatch.platformFeePercentage}%)</strong></span>
                    <span>·</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/30">
                      Exact Payout: ₦{myActiveMatch.winnerPayout.toLocaleString()}{myActiveMatch.matchType === 'squad' ? ' / winning player' : ''}
                    </span>
                    {myActiveMatch.matchType === 'squad' && (
                      <span className="text-neutral-400 font-sans text-[11px]">
                        (₦{(myActiveMatch.winnerPayout * 5).toLocaleString()} Team Prize Pool)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setArenaTab('active')}
                className={`w-full sm:w-auto px-6 py-2.5 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0 ${
                  myActiveMatch.matchType === 'squad' ? 'bg-emerald-400 hover:bg-emerald-300 text-neutral-950' : 'bg-amber-400 hover:bg-amber-300 text-neutral-950'
                }`}
              >
                Open Match Room <ArrowRight size={16} />
              </button>
            </div>
          )}

          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative overflow-hidden rounded-3xl p-6 border-2 border-amber-500/50 hover:border-amber-400 bg-neutral-900 shadow-xl transition-all flex flex-col justify-between min-h-[220px] group">
                 <div className="absolute inset-0 z-0 opacity-20"><img src={CODM_IMAGES.shipment1v1} className="w-full h-full object-cover" alt="" /></div>
                 <div className="relative z-10">
                   <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4"><Crosshair className="text-amber-400" /></div>
                   <h3 className="text-xl font-black text-white font-heading uppercase">SOLO 1V1 DUEL</h3>
                   <p className="text-xs text-neutral-400 mt-1">Snipers only or Gunfight on Shipment.</p>
                 </div>
                 <button onClick={() => onOpenCreateBet?.('1v1 Sniper Only', 1000)} className="relative z-10 mt-4 py-2.5 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs uppercase cursor-pointer hover:bg-amber-300">Generate Link</button>
              </div>
              <div className="relative overflow-hidden rounded-3xl p-6 border-2 border-emerald-500/50 hover:border-emerald-400 bg-neutral-900 shadow-xl transition-all flex flex-col justify-between min-h-[220px] group">
                 <div className="absolute inset-0 z-0 opacity-20"><img src={CODM_IMAGES.squadTactical} className="w-full h-full object-cover" alt="" /></div>
                 <div className="relative z-10">
                   <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4"><Users className="text-emerald-400" /></div>
                   <h3 className="text-xl font-black text-white font-heading uppercase">SQUAD BATTLE</h3>
                   <p className="text-xs text-neutral-400 mt-1">Tactical Search & Destroy or Hardpoint.</p>
                 </div>
                 <button onClick={() => onOpenCreateBet?.('Search & Destroy (S&D)', 1000)} className="relative z-10 mt-4 py-2.5 bg-emerald-500 text-neutral-950 font-black rounded-xl text-xs uppercase cursor-pointer hover:bg-emerald-400">Generate Link</button>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400">
                  <Zap size={16} className="text-amber-400" />
                  <span>Live Battles In Progress</span>
                </div>
              </div>
              {matches.filter(m => ['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(m.status)).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {matches.filter(m => ['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(m.status)).map(m => (
                    <div key={m.id} className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 flex flex-col justify-between shadow-lg relative overflow-hidden group">
                      <div className="absolute top-0 right-0 px-2 py-1 bg-amber-400 text-neutral-950 text-[8px] font-black uppercase rounded-bl-lg animate-pulse">LIVE NOW</div>
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-400/10 flex items-center justify-center text-amber-400"><Target size={18} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white truncate">{m.gameMode} · {m.map}</div>
                          <div className="text-[10px] text-neutral-400 truncate">Pot: ₦{m.potAmount.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <div className="flex -space-x-2">
                           <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(m.creator.codmIgn)}`} className="w-6 h-6 rounded-full border border-neutral-800 bg-neutral-900" alt="" />
                           {m.opponent && <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(m.opponent.codmIgn)}`} className="w-6 h-6 rounded-full border border-neutral-800 bg-neutral-900" alt="" />}
                        </div>
                        <span className="text-neutral-500">#{m.challengeCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-neutral-950 border border-dashed border-neutral-800 text-center text-neutral-500 text-[10px] italic">No active battles currently.</div>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-neutral-800">
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400"><Flame size={16} className="text-amber-400" /><span>Open Lobby Challenges</span></div><input type="text" placeholder="Search #Code" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-white" /></div>
              {filteredChallenges.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredChallenges.map(m => {
                    const isSquad = m.matchType === 'squad' || Boolean(m.squadData);
                    const filledSlots = m.squadData?.slots?.filter(s => s.staked).length || 1;
                    const userInSlot = m.squadData?.slots?.find(s => s.userId === currentUser.id && s.staked);

                    return (
                      <div key={m.id} className={`p-4 rounded-2xl bg-neutral-950 border transition-all flex flex-col justify-between shadow-lg ${
                        isSquad ? 'border-emerald-500/30 hover:border-emerald-400' : 'border-neutral-800 hover:border-amber-400/40'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                            #{m.challengeCode}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {isSquad && (
                              <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                                5v5 Squad ({filledSlots}/10)
                              </span>
                            )}
                            <span className="text-xs font-black text-emerald-400">
                              ₦{m.stakeAmount.toLocaleString()} {isSquad ? '/ player' : ''}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2.5 mb-3">
                          <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(m.creator.codmIgn)}`} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-white truncate">{m.creator.codmIgn}</div>
                            <div className="text-[10px] text-neutral-400 truncate">{m.gameMode} · {m.map}</div>
                          </div>
                        </div>

                        {/* Exact Payout & Pot Preview Box */}
                        <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-[10px] space-y-1 mb-3 font-mono">
                          <div className="flex justify-between items-center">
                            <span className="text-neutral-400">Total Pot:</span>
                            <span className="text-amber-400 font-bold">₦{m.potAmount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center border-t border-neutral-800/80 pt-1">
                            <span className="text-neutral-300 font-bold">{isSquad ? 'Exact Win Payout:' : 'Winner Payout:'}</span>
                            <span className="text-emerald-400 font-black">
                              ₦{m.winnerPayout.toLocaleString()} {isSquad ? '/ player' : ''}
                            </span>
                          </div>
                          {isSquad && (
                            <div className="flex justify-between items-center text-[9px] text-neutral-500">
                              <span>Winning Squad Net Pool:</span>
                              <span className="text-emerald-300 font-bold">₦{(m.winnerPayout * 5).toLocaleString()}</span>
                            </div>
                          )}
                        </div>

                        {isSquad ? (
                          <div className="space-y-2 pt-2 border-t border-neutral-900">
                            {userInSlot ? (
                              <button
                                onClick={() => onSquadLeave?.(m.id)}
                                className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold rounded-lg text-[10px] uppercase border border-rose-500/30 cursor-pointer"
                              >
                                Leave Squad (Refund ₦{m.stakeAmount.toLocaleString()})
                              </button>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => onSquadJoin?.(m.id, undefined, 'ALPHA')}
                                  className="py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-black rounded-lg text-[10px] uppercase border border-blue-500/40 cursor-pointer"
                                >
                                  Join Team Alpha
                                </button>
                                <button
                                  onClick={() => onSquadJoin?.(m.id, undefined, 'BRAVO')}
                                  className="py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 font-black rounded-lg text-[10px] uppercase border border-rose-500/40 cursor-pointer"
                                >
                                  Join Team Bravo
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => { setStakeTargetMatch(m); setStakeRole('opponent'); setIsStakeModalOpen(true); }}
                            className="w-full mt-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-black rounded-lg text-[10px] uppercase cursor-pointer"
                          >
                            Accept Duel
                          </button>
                        )}
                      </div>
                    );
                  })}

                </div>
              ) : <div className="p-10 rounded-2xl bg-neutral-950 border border-dashed border-neutral-800 text-center text-neutral-500 text-xs italic">No open challenges.</div>}
            </div>
          </div>
        </div>
      )}

      {/* 4. Active Match Tab */}
      {arenaTab === 'active' && (
        <div className="space-y-6">
          {/* Active Matches Multi-Room Selector - Premium Tactical Design */}
          {myActiveMatches.length > 1 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 text-xs font-black text-white uppercase tracking-widest">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Your Active War-Rooms ({myActiveMatches.length})</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">SELECT ROOM TO ENTER</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                {myActiveMatches.map(m => {
                  const isCreator = m.creator.id === currentUser.id;
                  const myClaim = isCreator ? m.creator.resultClaim : m.opponent?.resultClaim;
                  const isPending = myClaim && m.status !== 'SETTLED';
                  
                  return (
                    <button
                      key={m.id}
                      onClick={() => setSelectedActiveMatchId(m.id)}
                      className={`px-5 py-4 rounded-3xl border-2 shrink-0 transition-all flex flex-col gap-2 min-w-[180px] text-left relative overflow-hidden group ${
                        selectedActiveMatchId === m.id 
                          ? 'bg-amber-400 border-amber-400 text-neutral-950 shadow-2xl shadow-amber-400/20 scale-[1.02]' 
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className={`p-2 rounded-xl ${selectedActiveMatchId === m.id ? 'bg-black/10' : 'bg-neutral-800'}`}>
                          {m.matchType === 'squad' ? <Users size={18} /> : <Zap size={18} />}
                        </div>
                        {isPending && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500 text-white text-[8px] font-black uppercase tracking-tighter animate-pulse shadow-sm">
                            <Clock size={10} />
                            <span>PENDING</span>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-0.5">
                        <div className={`text-[10px] font-black uppercase tracking-widest ${selectedActiveMatchId === m.id ? 'opacity-70' : 'text-neutral-500'}`}>
                          {m.matchType === 'squad' ? '5v5 Squad' : '1v1 Duel'} #{m.challengeCode}
                        </div>
                        <div className="text-sm font-black font-mono tracking-tight truncate">
                          {m.roomCode ? `#${m.roomCode}` : 'Awaiting Rival'}
                        </div>
                      </div>

                      <div className={`text-[9px] font-bold mt-1 ${selectedActiveMatchId === m.id ? 'text-black/60' : 'text-emerald-500'}`}>
                        POT: ₦{m.potAmount.toLocaleString()}
                      </div>
                      
                      {selectedActiveMatchId === m.id && (
                        <div className="absolute bottom-0 left-0 h-1 bg-black/20 w-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {myActiveMatch ? (
            <>
              <div className="relative overflow-hidden rounded-[2.5rem] bg-neutral-900 border border-amber-500/40 p-5 sm:p-8 shadow-2xl space-y-6 group">
                <div className="absolute inset-0 z-0 opacity-25">
                  <img src={CODM_IMAGES.matchRoomBg} className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-1000" alt="" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/90 via-neutral-950/60 to-neutral-950/90" />
                </div>
                
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-800/80">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-inner">
                      {myActiveMatch.matchType === 'squad' ? <Users size={28} /> : <Target size={28} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${
                          localPendingSubmissions[myActiveMatch.id] || (isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim)
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 animate-pulse'
                            : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            localPendingSubmissions[myActiveMatch.id] ? 'bg-blue-400 animate-ping' : 'bg-emerald-400 animate-pulse'
                          }`} />
                          <span>
                            {localPendingSubmissions[myActiveMatch.id] 
                              ? 'UPLOADING PROOF...' 
                              : (isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim) && myActiveMatch.status !== 'SETTLED'
                                ? 'AWAITING REFEREE...'
                                : myActiveMatch.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {myActiveMatch.matchType === 'squad' && (
                          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">
                            5v5 BATTLE
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-black text-white font-heading uppercase tracking-tight">{myActiveMatch.gameMode} · {myActiveMatch.map}</h2>
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:items-end gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/80 border border-neutral-800 shadow-lg">
                        <span className="text-[10px] text-neutral-500 font-mono font-bold">ROOM CODE:</span>
                        <span className="text-base font-black text-amber-400 font-mono">{myActiveMatch.roomCode || myActiveMatch.challengeCode}</span>
                        <button 
                          onClick={() => copyCode(myActiveMatch.roomCode || myActiveMatch.challengeCode)} 
                          className="p-1.5 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-neutral-500 font-black uppercase tracking-widest block mb-0.5">Winner Payout</span>
                      <span className="text-xl font-black text-emerald-400 font-mono tracking-tighter">₦{myActiveMatch.winnerPayout.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex lg:hidden rounded-[1.25rem] bg-neutral-950 p-1 border border-neutral-800 shadow-inner">
                <button onClick={() => setActiveMatchSubTab('game')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeMatchSubTab === 'game' ? 'bg-amber-400 text-neutral-950 shadow-md' : 'text-neutral-500'}`}>🎮 Battleground</button>
                <button onClick={() => setActiveMatchSubTab('chat')} className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${activeMatchSubTab === 'chat' ? 'bg-amber-400 text-neutral-950 shadow-md' : 'text-neutral-500'}`}>
                  💬 Tactical Chat
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
                <div className={`lg:col-span-2 space-y-4 ${activeMatchSubTab === 'chat' ? 'hidden lg:block' : 'block'}`}>
                  {/* Exact Payout & Economics Box */}
                  {myActiveMatch.matchType === 'squad' ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900 border-2 border-emerald-500/40 space-y-3.5 shadow-xl animate-in fade-in">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                            <Users size={18} />
                          </div>
                          <div>
                            <div className="font-heading font-black text-xs sm:text-sm text-white uppercase tracking-wider">
                              5v5 Squad Escrow Pool & Exact Payout
                            </div>
                            <div className="text-[10px] text-neutral-400">
                              {myActiveMatch.roomCode ? `Private Battle Room Active (#${myActiveMatch.roomCode})` : 'Awaiting 10 Squad Slots to Fill'}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 block uppercase font-mono">Per-Winner Payout</span>
                          <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                            ₦{myActiveMatch.winnerPayout.toLocaleString()} <span className="text-[10px] font-sans text-neutral-400 font-normal">/ player</span>
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block uppercase font-sans">Stake / Player</span>
                          <span className="font-bold text-white text-sm">₦{myActiveMatch.stakeAmount.toLocaleString()}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block uppercase font-sans">Gross Pot (10x)</span>
                          <span className="font-bold text-amber-400 text-sm">₦{myActiveMatch.potAmount.toLocaleString()}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                          <span className="text-[10px] text-neutral-400 block uppercase font-sans">Squad Fee ({myActiveMatch.platformFeePercentage}%)</span>
                          <span className="font-bold text-rose-400 text-sm">-₦{myActiveMatch.platformFee.toLocaleString()}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-400/50 shadow">
                          <span className="text-[10px] text-emerald-300 block uppercase font-sans font-bold">Winning Squad Pool</span>
                          <span className="font-black text-emerald-400 text-sm">₦{(myActiveMatch.potAmount - myActiveMatch.platformFee).toLocaleString()}</span>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                        <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                          <Trophy size={15} className="text-amber-400 shrink-0" />
                          <span>Exact Payout per Winning Player:</span>
                          <span className="text-emerald-400 font-black text-sm bg-black/60 px-2 py-0.5 rounded border border-emerald-500/40 font-mono">
                            ₦{myActiveMatch.winnerPayout.toLocaleString()}
                          </span>
                          <span className="text-[10px] text-neutral-400 font-normal font-sans">/ player</span>
                        </span>
                        <span className="text-[11px] text-neutral-400">
                          All 5 players on winning squad credited ₦{myActiveMatch.winnerPayout.toLocaleString()} each (₦{((myActiveMatch.winnerPayout || 0) * 5).toLocaleString()} Team Prize Pool)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Clock size={16} className="animate-pulse" />
                        <span>{myActiveMatch.roomCode ? `Battle Room Ready (#${myActiveMatch.roomCode})` : 'Awaiting Opponent to Accept'}</span>
                      </div>
                      <span className="text-emerald-400 font-mono">Winner Payout: ₦{myActiveMatch.winnerPayout.toLocaleString()}</span>
                    </div>
                  )}

                  {myActiveMatch.matchType === 'squad' && myActiveMatch.squadData ? (
                    <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-emerald-500/30 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-black text-white uppercase tracking-wider font-heading">
                            5v5 Tactical Squad Roster ({myActiveMatch.squadData.slots.filter(s => s.staked).length}/10 Staked)
                          </span>
                        </div>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          ₦{myActiveMatch.stakeAmount.toLocaleString()} / SLOT
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 p-3 rounded-xl bg-blue-950/20 border border-blue-500/30">
                          <div className="flex justify-between items-center pb-2 border-b border-blue-500/20">
                            <span className="text-xs font-black text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-400" />
                              <span>Team Alpha</span>
                            </span>
                            <span className="text-[10px] font-mono font-bold text-blue-300">
                              {myActiveMatch.squadData.slots.slice(0, 5).filter(s => s.staked).length}/5 Staked
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {myActiveMatch.squadData.slots.slice(0, 5).map((slot, idx) => {
                              const isMe = slot.userId === currentUser.id;
                              return (
                                <div key={slot.slotIndex} className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                                  slot.staked ? 'bg-neutral-900 border-blue-500/30' : 'bg-neutral-950/60 border-dashed border-neutral-800'
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-[10px] font-mono text-neutral-500 w-4 shrink-0">#{idx + 1}</span>
                                    {slot.staked ? (
                                      <>
                                        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(slot.codmIgn || 'player')}`} alt="" className="w-6 h-6 rounded-md bg-neutral-800 shrink-0 object-cover" />
                                        <div className="min-w-0 flex-1">
                                          <div className="font-bold text-white text-[11px] truncate flex items-center gap-1">
                                            <span>{slot.codmIgn}</span>
                                            {slot.slotIndex === 0 && <span className="text-[9px] bg-amber-400/20 text-amber-300 px-1 rounded font-normal">Host</span>}
                                            {isMe && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-normal">You</span>}
                                          </div>
                                          <div className="text-[9px] font-mono text-neutral-400 truncate">UID: {slot.codmUid || 'N/A'}</div>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-neutral-500 text-[11px] italic">Empty Slot · Open</span>
                                    )}
                                  </div>
                                  <div className="shrink-0 flex items-center gap-1">
                                    {slot.staked ? (
                                      <>
                                        <button onClick={() => copyRivalIgn(slot.codmIgn || '')} className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white">
                                          <Copy size={11} />
                                        </button>
                                        {isMe && myActiveMatch.status === 'PENDING_OPPONENT_STAKE' && (
                                          <button onClick={() => onSquadLeave?.(myActiveMatch.id)} className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-[9px] border border-rose-500/30">
                                            Leave
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      !myActiveMatch.squadData?.slots?.some(s => s.userId === currentUser.id && s.staked) && (
                                        <button onClick={() => onSquadJoin?.(myActiveMatch.id, slot.slotIndex, 'ALPHA')} className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase transition-all">
                                          Join
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-2 p-3 rounded-xl bg-rose-950/20 border border-rose-500/30">
                          <div className="flex justify-between items-center pb-2 border-b border-rose-500/20">
                            <span className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-rose-400" />
                              <span>Team Bravo</span>
                            </span>
                            <span className="text-[10px] font-mono font-bold text-rose-300">
                              {myActiveMatch.squadData.slots.slice(5, 10).filter(s => s.staked).length}/5 Staked
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {myActiveMatch.squadData.slots.slice(5, 10).map((slot, idx) => {
                              const isMe = slot.userId === currentUser.id;
                              return (
                                <div key={slot.slotIndex} className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs transition-all ${
                                  slot.staked ? 'bg-neutral-900 border-rose-500/30' : 'bg-neutral-950/60 border-dashed border-neutral-800'
                                }`}>
                                  <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <span className="text-[10px] font-mono text-neutral-500 w-4 shrink-0">#{idx + 6}</span>
                                    {slot.staked ? (
                                      <>
                                        <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(slot.codmIgn || 'player')}`} alt="" className="w-6 h-6 rounded-md bg-neutral-800 shrink-0 object-cover" />
                                        <div className="min-w-0 flex-1">
                                          <div className="font-bold text-white text-[11px] truncate flex items-center gap-1">
                                            <span>{slot.codmIgn}</span>
                                            {isMe && <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded font-normal">You</span>}
                                          </div>
                                          <div className="text-[9px] font-mono text-neutral-400 truncate">UID: {slot.codmUid || 'N/A'}</div>
                                        </div>
                                      </>
                                    ) : (
                                      <span className="text-neutral-500 text-[11px] italic">Empty Slot · Open</span>
                                    )}
                                  </div>
                                  <div className="shrink-0 flex items-center gap-1">
                                    {slot.staked ? (
                                      <>
                                        <button onClick={() => copyRivalIgn(slot.codmIgn || '')} className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white">
                                          <Copy size={11} />
                                        </button>
                                        {isMe && myActiveMatch.status === 'PENDING_OPPONENT_STAKE' && (
                                          <button onClick={() => onSquadLeave?.(myActiveMatch.id)} className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-[9px] border border-rose-500/30">
                                            Leave
                                          </button>
                                        )}
                                      </>
                                    ) : (
                                      !myActiveMatch.squadData?.slots?.some(s => s.userId === currentUser.id && s.staked) && (
                                        <button onClick={() => onSquadJoin?.(myActiveMatch.id, slot.slotIndex, 'BRAVO')} className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[9px] uppercase transition-all">
                                          Join
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                          <UserCheck size={14} className="text-amber-400" />
                          <span>Rival In-Game Search Info ({isCreatorOfActive ? 'Opponent' : 'Host'})</span>
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">ONE-TAP COPY</span>
                      </div>
                      
                      {(() => {
                        const rival = isCreatorOfActive ? myActiveMatch.opponent : myActiveMatch.creator;
                        return (
                          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-xl bg-neutral-900 border border-neutral-800/80">
                            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rival?.codmIgn || 'player')}`} alt="" className="w-10 h-10 rounded-xl bg-neutral-800 shrink-0 object-cover" />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                                  <span>{rival?.codmIgn || 'Awaiting Opponent...'}</span>
                                </div>
                                <div className="text-[10px] font-mono text-neutral-400 truncate">
                                  UID: {rival?.codmUid || 'N/A'}
                                </div>
                              </div>
                            </div>

                            {rival && (
                              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                <button
                                  type="button"
                                  onClick={() => copyRivalIgn(rival.codmIgn)}
                                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-95"
                                >
                                  {copiedRivalIgn ? <Check size={14} className="stroke-[3]" /> : <Copy size={14} />}
                                  <span>{copiedRivalIgn ? 'IGN Copied!' : 'Copy IGN'}</span>
                                </button>
                                {rival.codmUid && (
                                  <button
                                    type="button"
                                    onClick={() => copyRivalUid(rival.codmUid)}
                                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-700 transition-all active:scale-95"
                                  >
                                    {copiedRivalUid ? <Check size={14} className="stroke-[3] text-emerald-400" /> : <Copy size={14} />}
                                    <span>{copiedRivalUid ? 'UID Copied!' : 'Copy UID'}</span>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {myActiveMatch.status === 'PENDING_OPPONENT_STAKE' && (
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                      <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Share Invite Link</div>
                      <div className="flex gap-2"><input type="text" readOnly value={`${window.location.origin}/?join=${myActiveMatch.id}`} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-400" /><button onClick={() => copyInviteLink(myActiveMatch.id)} className="px-4 py-2 bg-amber-400 text-neutral-950 font-black text-[10px] rounded-lg uppercase">Copy Link</button></div>
                    </div>
                  )}

                  {['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(myActiveMatch.status) && (
                    <div className="space-y-4">
                      {myActiveMatch.roomGeneratedAt && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-black border border-neutral-800">
                          <div className="flex items-center gap-2 text-neutral-400 text-[10px] font-bold uppercase tracking-wider"><Clock size={14} className="text-amber-400" /><span>Match Timer:</span><span className={`font-mono text-xs ${isExpired ? 'text-rose-500' : 'text-amber-400'}`}>{timeLeft}</span></div>
                          <span className="text-neutral-500 text-[9px] uppercase font-bold tracking-wider">{isExpired ? 'Timer Exceeded (No Auto-Settle)' : 'Active Battle'}</span>
                        </div>
                      )}
                      
                      {myActiveMatch.roomCode && (
                        <div className="p-5 rounded-2xl bg-amber-500/10 border-2 border-amber-400/40 text-center space-y-2">
                          <div className="text-[10px] text-neutral-400 uppercase font-mono font-bold tracking-tighter">Private Room #</div>
                          <div className="flex items-center justify-center gap-3"><span className="text-4xl font-black text-amber-400 font-mono tracking-widest">{myActiveMatch.roomCode}</span><button onClick={() => copyCode(myActiveMatch.roomCode!)} className="p-2 rounded-lg bg-neutral-800 text-white shadow-lg"><Copy size={18} /></button></div>
                          <p className="text-[10px] text-neutral-400 italic">Enter code in In-Game Multiplayer &gt; Private Match</p>
                        </div>
                      )}

                      {myActiveMatch.status === 'DISPUTED' ? (
                        <div className="p-5 sm:p-6 rounded-2xl bg-rose-950/40 border-2 border-rose-500/60 space-y-5 animate-in zoom-in-95">
                          <div className="flex gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0">
                              <AlertTriangle className="text-rose-400" />
                            </div>
                            <div>
                              <div className="text-sm font-black text-white uppercase">Dispute Detected!</div>
                              <p className="text-[11px] text-neutral-400">
                                Conflicting claims submitted. Escrow funds are safely locked. Use the automated Telegram Bot button below to submit your screen recording.
                              </p>
                            </div>
                          </div>

                          {/* Mandatory Video Guide Player */}
                          <VideoTutorial
                            title="Mandatory Video Guide: How to Screen Record Proof"
                            description="Follow this tutorial to record your match history and end-game victory/defeat scoreboard. Proofs are evaluated by human referees."
                          />

                          {/* Telegram Bot /dispute Command Action Box */}
                          <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-950/60 to-neutral-900 border border-sky-500/30 space-y-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0">
                                <Send className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-xs sm:text-sm font-black text-white uppercase font-heading">
                                  Telegram Bot /dispute Command
                                </h4>
                                <p className="text-[11px] text-neutral-400">
                                  Launch Telegram Bot with <code className="text-sky-400 font-mono">/dispute {myActiveMatch.roomCode || myActiveMatch.challengeCode}</code> to upload screen recording.
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                              <a
                                href={`https://t.me/OpsStakeBot?start=dispute_${encodeURIComponent(myActiveMatch.roomCode || myActiveMatch.challengeCode)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-full sm:flex-1 py-3 bg-sky-500 hover:bg-sky-400 text-neutral-950 text-xs font-black rounded-xl transition-all shadow-lg cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide"
                              >
                                <MessageCircle className="w-4 h-4" />
                                <span>Open Telegram Bot & Send /dispute</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => copyCode(`/dispute ${myActiveMatch.roomCode || myActiveMatch.challengeCode}`)}
                                className="w-full sm:w-auto px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl border border-neutral-700 transition-all cursor-pointer flex items-center justify-center gap-2 font-mono"
                              >
                                {copiedCode ? (
                                  <>
                                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                                    <span className="text-emerald-400">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 text-neutral-400" />
                                    <span>Copy /dispute {myActiveMatch.roomCode || myActiveMatch.challengeCode}</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <p className="text-[10px] text-neutral-400 italic">
                              Once received by the Telegram bot, your video is automatically forwarded to the referee group for rapid review.
                            </p>
                          </div>
                        </div>
                      ) : (isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim) ? (
                        <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4 animate-in fade-in">
                          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                              <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
                                Awaiting Rival Confirmation
                              </span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-neutral-400">
                              Pot: ₦{myActiveMatch.potAmount.toLocaleString()}
                            </span>
                          </div>

                          <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Your Submitted Outcome:</span>
                              <span className={`text-xs font-black px-2.5 py-1 rounded-lg border font-mono ${
                                (isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim) === 'VICTORY'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                  : (isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim) === 'DEFEAT'
                                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                                  : 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                              }`}>
                                {(isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim) === 'VICTORY'
                                  ? 'I Won 🏆'
                                  : (isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim) === 'DEFEAT'
                                  ? 'I Lost ❌'
                                  : 'Draw ⚖️'}
                              </span>
                            </div>

                            <div className="p-3.5 rounded-xl bg-black/60 border border-neutral-800/80 flex items-start gap-3">
                              <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-spin" />
                              <div className="space-y-1 text-xs">
                                <div className="font-bold text-white">
                                  Waiting for {isCreatorOfActive ? (myActiveMatch.opponent?.codmIgn || 'Opponent') : myActiveMatch.creator.codmIgn} to confirm...
                                </div>
                                <p className="text-neutral-400 text-[11px] leading-relaxed">
                                  Your result has been registered. The referee system is waiting for your rival to submit on their screen. Once both players submit, the match will resolve and winner payout will release immediately!
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
                          {(myActiveMatch.conflictRetries ?? 0) > 0 && (
                            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-400 flex flex-col gap-1.5 animate-pulse">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <strong className="uppercase">Result Conflict detected!</strong>
                              </div>
                              <p className="text-[10px] text-neutral-400">
                                Both players submitted different results. You have <strong>{3 - (myActiveMatch.conflictRetries ?? 0)} retries remaining</strong> before mandatory screenshot review. Please confirm the correct outcome.
                              </p>
                              
                              {/* Conflict Guide Video Player */}
                              <div className="mt-4 rounded-xl overflow-hidden border-2 border-rose-500/50 bg-black aspect-video relative shadow-2xl">
                                <iframe
                                  className="w-full h-full"
                                  src="https://www.youtube.com/embed/L8s4zUbMoMo"
                                  title="How to record match results"
                                  frameBorder="0"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  loading="eager"
                                ></iframe>
                                <div className="absolute top-2 left-2 px-2 py-1 bg-rose-500 text-white text-[9px] font-black uppercase rounded shadow-lg">MANDATORY GUIDE: HOW TO RECORD PROOF</div>
                              </div>
                            </div>
                          )}
                          
                          {(isCreatorOfActive ? myActiveMatch.opponent?.resultClaim : myActiveMatch.creator.resultClaim) && (
                            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2.5 animate-in fade-in">
                              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                              <span>
                                <strong>{isCreatorOfActive ? (myActiveMatch.opponent?.codmIgn || 'Opponent') : myActiveMatch.creator.codmIgn}</strong> declared: <strong className="underline uppercase">
                                  {(isCreatorOfActive ? myActiveMatch.opponent?.resultClaim : myActiveMatch.creator.resultClaim) === 'VICTORY'
                                    ? 'I Won 🏆'
                                    : (isCreatorOfActive ? myActiveMatch.opponent?.resultClaim : myActiveMatch.creator.resultClaim) === 'DEFEAT'
                                    ? 'I Lost ❌'
                                    : 'Draw ⚖️'}
                                </strong>. Select your outcome below to settle!
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-neutral-400">
                            <span>Match Ended? Confirm Result</span>
                            <span className="text-amber-400">Winner Payout: ₦{myActiveMatch.winnerPayout.toLocaleString()}</span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2">
                            {(['VICTORY', 'DEFEAT', 'DRAW'] as const).map(claim => (
                              <button key={claim} onClick={() => setSelectedClaim(claim)} className={`py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${selectedClaim === claim ? 'bg-amber-400 text-neutral-950 border-amber-400 shadow-lg scale-105' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}>
                                {claim === 'VICTORY' ? 'I Won' : claim === 'DEFEAT' ? 'I Lost' : 'Draw'}
                              </button>
                            ))}
                          </div>
                          
                          <button 
                            onClick={() => handleResultSubmit(myActiveMatch.id)} 
                            disabled={isSubmitting} 
                            className="w-full py-4 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs uppercase shadow-xl transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isSubmitting ? 'Confirming...' : `Submit "${selectedClaim}" Confirmation`}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {myActiveMatch.status === 'SETTLED' && (
                    <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-500/20 to-neutral-950 border border-amber-500/40 text-center space-y-4">
                      <div className="w-12 h-12 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center mx-auto"><Trophy size={24} /></div>
                      <div className="text-xl font-black text-white uppercase font-heading">{myActiveMatch.winnerIgn?.includes('DRAW') ? 'Result: DRAW' : `Winner: ${myActiveMatch.winnerIgn}`}</div>
                      <div className="flex justify-center gap-3"><button onClick={() => handleReturnToLobby(myActiveMatch.id)} className="px-5 py-2 bg-amber-400 text-neutral-950 font-black rounded-xl text-[10px] uppercase">Back to Lobby</button><button onClick={() => onDismissMatch(myActiveMatch.id)} className="px-5 py-2 bg-neutral-800 text-white font-bold rounded-xl text-[10px] uppercase">Dismiss</button></div>
                    </div>
                  )}
                  
                  {myActiveMatch.status === 'ABANDONED' && (
                    <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-500/40 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto"><AlertTriangle /></div>
                      <div className="text-sm font-black text-white uppercase">Match Abandoned</div>
                      <p className="text-[10px] text-neutral-400">Stake refunded minus platform fee.</p>
                      <div className="flex justify-center gap-2 pt-2"><button onClick={() => handleReturnToLobby(myActiveMatch.id)} className="px-4 py-1.5 bg-amber-400 text-neutral-950 font-bold rounded-lg text-[10px] uppercase">Lobby</button><button onClick={() => onDismissMatch(myActiveMatch.id)} className="px-4 py-1.5 bg-neutral-800 text-white font-bold rounded-lg text-[10px] uppercase">Clear</button></div>
                    </div>
                  )}
                </div>

                <div className={`space-y-4 ${activeMatchSubTab === 'game' ? 'hidden lg:block' : 'block'}`}>
                  <div className="p-4 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-3 sticky top-4">
                    <div className="flex items-center gap-2 pb-1"><MessageCircle size={18} className="text-emerald-400" /><span className="text-xs font-black uppercase tracking-widest text-white">Match Chat</span></div>
                    <div className="relative h-[550px] rounded-2xl overflow-hidden shadow-inner border border-white/5">
                      <MatchLobbyChat
                        matchId={myActiveMatch.id}
                        currentUser={currentUser}
                        opponentName={isCreatorOfActive ? (myActiveMatch.opponent?.codmIgn || 'Opponent') : myActiveMatch.creator.codmIgn}
                        initialMessages={myActiveMatch.chatMessages || []}
                        isSettled={['SETTLED', 'ABANDONED', 'CANCELLED'].includes(myActiveMatch.status)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-16 rounded-3xl bg-neutral-900 border border-neutral-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-800 text-neutral-500 flex items-center justify-center mx-auto"><Zap size={32} /></div>
              <div className="text-2xl font-black font-heading text-white uppercase">No Active Battle</div>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">You're not currently in a match. Start a new wager or accept a challenge!</p>
              <button onClick={() => setArenaTab('live')} className="px-8 py-3 bg-amber-400 text-neutral-950 font-black rounded-2xl text-xs uppercase shadow-lg">Browse Live Lobby</button>
            </div>
          )}
        </div>
      )}

      {/* 4. Active Rivals Radar Tab */}
      {arenaTab === 'rivals' && (
        <div className="space-y-6">
          {/* Tactical Radar Header */}
          <div className="relative overflow-hidden p-6 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl">
            <CardBackground />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_#10b981]" />
                  <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
                    Tactical Radar · Live Roster
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wider font-heading flex items-center gap-2">
                  <Radio className="text-amber-400" size={24} />
                  Active Rivals Command
                </h2>
                <p className="text-xs text-neutral-400 max-w-xl">
                  Real-time presence radar of your rivals. Challenge active players to instant 1v1 wagers or coordinate matches via private comms.
                </p>
              </div>

              {/* Status Chips & Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 border border-neutral-800 text-xs font-mono">
                  <span className="text-neutral-400">Online Now:</span>
                  <span className="text-emerald-400 font-black flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {onlineRivalsCount} / {activeRivals.length}
                  </span>
                </div>
                <button
                  onClick={loadActiveRivals}
                  disabled={rivalsLoading}
                  className="p-2.5 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-200 rounded-xl transition-all cursor-pointer border border-neutral-700/60"
                  title="Refresh Radar"
                >
                  <RefreshCw size={16} className={rivalsLoading ? 'animate-spin text-amber-400' : ''} />
                </button>
                <button
                  onClick={() => navigate('/social')}
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow cursor-pointer flex items-center gap-1.5"
                >
                  <Users size={14} />
                  Find Rivals
                </button>
              </div>
            </div>

            {/* Tactical Search & Filter Bar */}
            <div className="relative z-10 mt-6 pt-4 border-t border-neutral-800/80 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Filter by rival IGN or username..."
                  value={rivalsSearch}
                  onChange={(e) => setRivalsSearch(e.target.value)}
                  className="w-full bg-black/70 border border-neutral-800 focus:border-amber-400 text-xs text-white pl-10 pr-8 py-2.5 rounded-xl transition-all placeholder:text-neutral-600 focus:outline-none"
                />
                {rivalsSearch && (
                  <button
                    onClick={() => setRivalsSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Filter Tabs (All vs Online) */}
              <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-neutral-800 shrink-0">
                <button
                  onClick={() => setRivalsFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                    rivalsFilter === 'ALL'
                      ? 'bg-amber-400 text-neutral-950 shadow'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  All ({activeRivals.length})
                </button>
                <button
                  onClick={() => setRivalsFilter('ONLINE')}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    rivalsFilter === 'ONLINE'
                      ? 'bg-emerald-500 text-neutral-950 shadow font-black'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Online ({onlineRivalsCount})
                </button>
              </div>
            </div>
          </div>

          {/* Rivals Grid or Empty States */}
          {rivalsLoading && activeRivals.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(idx => (
                <div key={idx} className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 animate-pulse space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-neutral-800" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 bg-neutral-800 rounded w-1/3" />
                      <div className="h-3 bg-neutral-800 rounded w-1/2" />
                    </div>
                  </div>
                  <div className="h-9 bg-neutral-800 rounded-xl" />
                </div>
              ))}
            </div>
          ) : activeRivals.length === 0 ? (
            <div className="p-16 rounded-3xl bg-neutral-900 border border-neutral-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-800 text-neutral-500 flex items-center justify-center mx-auto">
                <Users size={32} />
              </div>
              <div className="text-2xl font-black font-heading text-white uppercase">
                No Rivals on Radar
              </div>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                You haven't added any rivals to your battle roster yet. Recruit rivals from the Social network to challenge them to 1v1 wagers!
              </p>
              <button
                onClick={() => navigate('/social')}
                className="px-8 py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-2xl text-xs uppercase shadow-lg transition-all"
              >
                Find & Add Rivals
              </button>
            </div>
          ) : filteredRivals.length === 0 ? (
            <div className="p-16 rounded-3xl bg-neutral-900 border border-neutral-800 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-neutral-800 text-neutral-500 flex items-center justify-center mx-auto">
                <Target size={32} />
              </div>
              <div className="text-xl font-black font-heading text-white uppercase">
                {rivalsFilter === 'ONLINE' ? 'No Rivals Currently Online' : 'No Rivals Matched Search'}
              </div>
              <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                {rivalsFilter === 'ONLINE'
                  ? 'All of your rivals are currently offline. You can still challenge them or browse all rivals.'
                  : `No rivals found matching "${rivalsSearch}". Try clearing your search.`}
              </p>
              <div className="flex items-center justify-center gap-3">
                {rivalsFilter === 'ONLINE' && (
                  <button
                    onClick={() => setRivalsFilter('ALL')}
                    className="px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs uppercase transition-all"
                  >
                    View All Rivals ({activeRivals.length})
                  </button>
                )}
                {rivalsSearch && (
                  <button
                    onClick={() => setRivalsSearch('')}
                    className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase transition-all"
                  >
                    Clear Search
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredRivals.map(rival => {
                const isOnline = Boolean(rival.isOnline);
                const wins = rival.stats?.wins ?? 0;
                const losses = rival.stats?.losses ?? 0;
                const winRate = rival.stats?.winRate ?? 0;
                const tier = rival.tier || 'ROOKIE';

                return (
                  <div
                    key={rival.id}
                    className={`relative overflow-hidden p-5 rounded-2xl bg-neutral-900 border transition-all ${
                      isOnline
                        ? 'border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.08)] hover:border-emerald-400/80'
                        : 'border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar with Presence Indicator */}
                        <div className="relative shrink-0">
                          {rival.avatarUrl ? (
                            <img
                              src={rival.avatarUrl}
                              alt={rival.codmIgn}
                              className="w-12 h-12 rounded-xl object-cover border border-neutral-700"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400 font-black text-base">
                              {(rival.codmIgn || rival.username || '?').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-neutral-900 ${
                              isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'
                            }`}
                          />
                        </div>

                        {/* Name, Tier & Status */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-white truncate font-heading tracking-wide">
                              {rival.codmIgn || rival.username}
                            </h3>
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/30 shrink-0">
                              {tier}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[11px] font-bold flex items-center gap-1.5 ${
                              isOnline ? 'text-emerald-400' : 'text-neutral-500'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                              {isOnline ? (rival.currentActivity || 'Active Online') : 'Offline'}
                            </span>
                            <span className="text-neutral-600 text-xs">·</span>
                            <span className="text-neutral-400 text-[11px] font-mono">
                              @{rival.username}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Online Status Tactical Pill */}
                      {isOnline && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          <Zap size={10} />
                          READY TO BATTLE
                        </span>
                      )}
                    </div>

                    {/* Stats HUD Bar */}
                    <div className="mt-4 p-2.5 rounded-xl bg-black/60 border border-neutral-800/80 flex items-center justify-between text-xs font-mono">
                      <div className="flex items-center gap-3">
                        <span className="text-neutral-400">
                          Wins: <strong className="text-emerald-400">{wins}</strong>
                        </span>
                        <span className="text-neutral-600">/</span>
                        <span className="text-neutral-400">
                          Losses: <strong className="text-rose-400">{losses}</strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-neutral-400">Win Rate:</span>
                        <span className="text-amber-400 font-bold">{winRate}%</span>
                      </div>
                    </div>

                    {/* Actions: Challenge 1v1 + Chat */}
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        onClick={() => onOpenCreateBet?.(undefined, undefined, rival.id)}
                        className="py-2.5 px-3 bg-amber-400 hover:bg-amber-300 active:scale-95 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Swords size={14} />
                        Challenge 1v1
                      </button>

                      <button
                        onClick={() => navigate(`/social?chat=${rival.id}`)}
                        className="py-2.5 px-3 bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all border border-neutral-700/60 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle size={14} />
                        Chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Hosted Bets Tab */}
      {arenaTab === 'hosted' && (
        <div className="space-y-6">
          <h2 className="text-2xl font-black text-white uppercase tracking-widest">My Hosted Bets</h2>
          {myHostedBets.length === 0 ? <div className="p-16 rounded-3xl bg-neutral-900 border border-neutral-800 text-center text-neutral-500 uppercase font-bold tracking-tighter">No Hosted Bets.</div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myHostedBets.map(m => {
                const isSquad = m.matchType === 'squad' || Boolean(m.squadData);
                const filledSlots = m.squadData?.slots?.filter(s => s.staked).length || 1;
                return (
                  <div key={m.id} className={`p-5 rounded-2xl bg-neutral-900 border space-y-4 ${isSquad ? 'border-emerald-500/40' : 'border-amber-500/30'}`}>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-amber-400">#CHALLENGE_{m.challengeCode}</span>
                        {isSquad && (
                          <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/30">
                            5v5 Squad ({filledSlots}/10)
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-black text-emerald-400">₦{m.stakeAmount.toLocaleString()} {isSquad ? '/ player' : ''}</span>
                    </div>
                    <div className="text-sm font-bold text-white uppercase">{m.gameMode} · {m.map}</div>

                    {/* Exact Payout & Pot Preview Box */}
                    <div className="p-3 rounded-xl bg-black/60 border border-neutral-800 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-neutral-400">{isSquad ? 'Total Gross Pot (10 Players):' : 'Total Pot (2x Stake):'}</span>
                        <span className="text-amber-400 font-bold">₦{m.potAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-emerald-400 font-bold border-t border-neutral-800/80 pt-1">
                        <span>{isSquad ? 'Exact Payout / Winning Player:' : 'Exact Winner Payout:'}</span>
                        <span className="text-sm text-emerald-400 font-black">₦{m.winnerPayout.toLocaleString()}</span>
                      </div>
                      {isSquad && (
                        <div className="flex justify-between items-center text-[10px] text-neutral-400">
                          <span>Winning Squad Net Pool:</span>
                          <span className="text-emerald-300">₦{(m.winnerPayout * 5).toLocaleString()}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button onClick={() => setArenaTab('active')} className="px-4 py-2 bg-amber-400 text-neutral-950 font-black rounded-xl text-[10px] uppercase cursor-pointer hover:bg-amber-300 transition-all">
                        Open Room
                      </button>
                      <button onClick={() => copyInviteLink(m.id)} className="flex-1 py-2 bg-neutral-800 text-white font-bold rounded-xl text-[10px] uppercase cursor-pointer hover:bg-neutral-700 transition-all">
                        {copiedLink ? 'Link Copied!' : 'Copy Link'}
                      </button>
                      <button onClick={() => onCancelMatch(m.id)} className="px-4 py-2 bg-rose-500/20 text-rose-400 font-bold rounded-xl text-[10px] uppercase border border-rose-500/40 cursor-pointer hover:bg-rose-500/30 transition-all">
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 6. Modals */}

      <StakePaymentModal isOpen={isStakeModalOpen} match={stakeTargetMatch} currentUser={currentUser} role={stakeRole} onClose={() => { setIsStakeModalOpen(false); setStakeTargetMatch(null); }} onConfirmStake={handleConfirmStake} />
      <IOSNotificationGuideModal isOpen={showIOSGuideModal} onClose={() => setShowIOSGuideModal(false)} />

      {/* MANDATORY 'JOIN OFFICIAL CHANNEL' BLOCKING OVERLAY FOR ARENA ACCESS */}
      {!currentUser.telegramChatId && currentUser.id !== 'guest' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="relative w-full max-w-lg bg-neutral-900 border-2 border-amber-500/80 rounded-[2.5rem] p-6 sm:p-8 shadow-[0_0_80px_rgba(245,158,11,0.25)] space-y-6 overflow-hidden">
            {/* Ambient Background Accents */}
            <div className="absolute -right-20 -top-20 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
            <div className="absolute -left-20 -bottom-20 w-60 h-60 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />

            {/* Header Badge */}
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-amber-600 text-neutral-950 flex items-center justify-center shadow-xl shadow-amber-500/20 shrink-0">
                <ShieldCheck className="w-9 h-9 stroke-[2.5]" />
              </div>
              <div className="space-y-1">
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-black uppercase tracking-[0.2em] font-mono inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  MANDATORY ACCESS VERIFICATION
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-heading">
                  Join Official Channel
                </h2>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-md pt-1">
                  To view live wagers, create duels, and receive instant in-game CODM room codes, you must join <strong className="text-amber-400">https://t.me/OpsSTAKE</strong> and link your Telegram account.
                </p>
              </div>
            </div>

            {/* Verification Steps Box */}
            <div className="space-y-3 bg-neutral-950/80 p-4 sm:p-5 rounded-3xl border border-neutral-800/80">
              {/* Step 1: Join Channel */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900 border border-cyan-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono font-black text-xs">
                    1
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Join Live Updates Channel</div>
                    <div className="text-[11px] font-mono text-cyan-400">t.me/OpsSTAKE</div>
                  </div>
                </div>
                <a
                  href="https://t.me/OpsSTAKE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-300 text-xs font-black rounded-xl uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                >
                  Join <ExternalLink size={14} />
                </a>
              </div>

              {/* Step 2: Connect Bot */}
              <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-900 border border-amber-500/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono font-black text-xs">
                    2
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">1-Tap Connect Telegram Bot</div>
                    <div className="text-[11px] font-mono text-amber-400">@{botUsername}</div>
                  </div>
                </div>
                <a
                  href={`https://t.me/${botUsername}?start=link_${currentUser.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black rounded-xl uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-md"
                >
                  Connect <Zap size={14} fill="black" />
                </a>
              </div>
            </div>

            {/* Check Verification Action */}
            <div className="space-y-2 pt-1">
              <button
                onClick={async () => {
                  setIsVerifyingChannel(true);
                  await onRefresh();
                  setTimeout(() => setIsVerifyingChannel(false), 1200);
                }}
                disabled={isVerifyingChannel}
                className="w-full py-4 px-5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
              >
                <RefreshCw size={18} className={isVerifyingChannel ? 'animate-spin' : ''} />
                <span>{isVerifyingChannel ? 'Checking Verification...' : 'I Have Joined — Unlock Arena'}</span>
              </button>
              <p className="text-[11px] text-center text-neutral-400 font-mono">
                Verification status syncs automatically via WebSockets
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
