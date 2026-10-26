import React, { useState, useEffect } from 'react';
import { UserProfile, Match } from '../types';
import {
  Swords, ShieldCheck, Trophy, Copy, Check, Share2, Upload,
  ArrowRight, AlertCircle, CheckCircle2, MessageCircle, Wallet,
  UserCheck, RefreshCw, Sparkles, Crosshair, Target, X, Plus,
  Flame, Zap, Users, Flag, Shield, Sliders, ChevronRight, Gamepad2, MapPin,
  TrendingUp, Award, Clock, Lock, AlertTriangle, XCircle, Bell, Info, ExternalLink
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { SkeletonLoader } from './SkeletonLoader';
import { StakePaymentModal } from './StakePaymentModal';
import { MatchLobbyChat } from './MatchLobbyChat';
import { calculateAbandonedMatchRefund } from '../utils/feeCalculator';
import { requestNotificationPermission, getNotificationPermission, isIOS, isStandalone } from '../services/notificationService';
import { IOSNotificationGuideModal } from './IOSNotificationGuideModal';

const CardBackground = () => (
  <div className="absolute inset-0 z-0 opacity-10">
    <img src={CODM_IMAGES.cardBgSubtle} alt="" className="w-full h-full object-cover" />
    <div className="absolute inset-0 bg-neutral-900/60" />
  </div>
);

interface CoreArenaProps {
  currentUser: UserProfile;
  matches: Match[];
  isMatchesLoading?: boolean;
  onCreateBet: (data: { stakeAmount: number; gameMode: string; map: string; rules: string[]; matchDurationMinutes?: number; isPublic?: boolean; matchType?: 'solo' | 'squad' }) => Promise<void>;
  onOpenCreateBet?: (mode?: string, stake?: number) => void;
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

  const [dismissedMatchIds, setDismissedMatchIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('codm_dismissed_matches') || '[]'); } catch { return []; }
  });

  const activeStatuses = ['PENDING_OPPONENT_STAKE', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'];
  const myActiveMatch = matches.find(m => {
    const isCreator = m.creator.id === currentUser.id;
    const isOpponent = m.opponent?.id === currentUser.id;
    const isInSquad = m.squadData?.slots?.some(s => s.userId === currentUser.id && s.staked);
    return (isCreator || isOpponent || isInSquad) && activeStatuses.includes(m.status);
  });
  const [arenaTab, setArenaTab] = useState<'live' | 'active' | 'hosted'>(() => myActiveMatch ? 'active' : 'live');


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
    if (myActiveMatch && ['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(myActiveMatch.status)) setArenaTab('active');
  }, [myActiveMatch?.status]);

  const openChallenges = matches.filter(m => m.status === 'PENDING_OPPONENT_STAKE' && m.isPublic !== false);
  const myHostedBets = matches.filter(m => m.creator.id === currentUser.id && m.status === 'PENDING_OPPONENT_STAKE');
  const isCreatorOfActive = myActiveMatch?.creator.id === currentUser.id;
  const filteredChallenges = openChallenges.filter(m => searchQuery.trim() === '' || m.challengeCode.toUpperCase().includes(searchQuery.trim().toUpperCase()));

  const copyCode = (code: string) => { navigator.clipboard.writeText(code); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };
  const copyInviteLink = (matchId: string) => { navigator.clipboard.writeText(`${window.location.origin}/?join=${matchId}`); setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); };
  const copyRivalIgn = (ign: string) => { navigator.clipboard.writeText(ign); setCopiedRivalIgn(true); setTimeout(() => setCopiedRivalIgn(false), 2000); };
  const copyRivalUid = (uid: string) => { navigator.clipboard.writeText(uid); setCopiedRivalUid(true); setTimeout(() => setCopiedRivalUid(false), 2000); };

  const handleResultSubmit = async (matchId: string, directClaim?: 'VICTORY' | 'DEFEAT' | 'DRAW') => {
    const claim = directClaim || selectedClaim;
    if (myActiveMatch?.status === 'DISPUTED' && !screenshotPreview) { setSubmitError('Screenshot required for dispute.'); return; }
    setIsSubmitting(true); setSubmitError(null);
    try { await onSubmitResult(matchId, claim, screenshotPreview || undefined); if (myActiveMatch?.status === 'DISPUTED') setScreenshotPreview(null); } 
    catch (err: any) { setSubmitError(err.message || 'Submission failed'); } 
    finally { setIsSubmitting(false); }
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

      {/* 2. Tab Switcher */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900 border border-neutral-800 max-w-xl mx-auto">
        {(['live', 'active', 'hosted'] as const).map(tab => (
          <button key={tab} onClick={() => setArenaTab(tab)} className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${arenaTab === tab ? 'bg-amber-400 text-neutral-950 shadow-lg' : 'text-neutral-400 hover:text-white'}`}>
            {tab === 'live' && <Flame size={16} />} {tab === 'active' && <Zap size={16} />} {tab === 'hosted' && <Swords size={16} />}
            <span className="capitalize">{tab} {tab === 'active' ? '' : `(${tab === 'live' ? openChallenges.length : myHostedBets.length})`}</span>
          </button>
        ))}
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
              <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-400"><Flame size={16} className="text-amber-400" /><span>Lobby Challenges</span></div><input type="text" placeholder="Search #Code" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-neutral-950 border border-neutral-800 rounded-lg py-1.5 px-3 text-xs text-white" /></div>
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
                          <img src={m.creator.avatar} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 object-cover" />
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
        myActiveMatch ? (
          <div className="relative overflow-hidden rounded-2xl bg-neutral-900 border border-amber-500/40 p-5 sm:p-6 shadow-xl space-y-5 group">
            <div className="absolute inset-0 z-0 opacity-20"><img src={CODM_IMAGES.matchRoomBg} className="w-full h-full object-cover" alt="" /><div className="absolute inset-0 bg-neutral-950/80" /></div>
            
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-neutral-800/80">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{myActiveMatch.status.replace(/_/g, ' ')}</span>
                </div>
                <span className="text-xs font-bold text-white">{myActiveMatch.gameMode}</span>
                {myActiveMatch.matchType === 'squad' && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30 flex items-center gap-1">
                    <Users size={12} />
                    <span>5v5 Squad ({myActiveMatch.squadData?.slots?.filter(s => s.staked).length || 1}/10 Slots)</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black border border-neutral-800">
                  <span className="text-[10px] text-neutral-400 font-mono">CODE:</span>
                  <span className="text-xs font-black text-amber-400">{myActiveMatch.roomCode || myActiveMatch.challengeCode}</span>
                  <button onClick={() => copyCode(myActiveMatch.roomCode || myActiveMatch.challengeCode)} className="text-neutral-500 ml-1 hover:text-white"><Copy size={12} /></button>
                </div>
                <div className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold font-mono">
                  {myActiveMatch.matchType === 'squad' ? `Gross Pot: ₦${myActiveMatch.potAmount.toLocaleString()}` : `Pot: ₦${myActiveMatch.potAmount.toLocaleString()}`}
                </div>
              </div>
            </div>

            <div className="relative z-10 flex lg:hidden rounded-xl bg-neutral-950 p-1 border border-neutral-800">
              <button onClick={() => setActiveMatchSubTab('game')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg ${activeMatchSubTab === 'game' ? 'bg-amber-400 text-neutral-950' : 'text-neutral-400'}`}>🎮 Game</button>
              <button onClick={() => setActiveMatchSubTab('chat')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg ${activeMatchSubTab === 'chat' ? 'bg-amber-400 text-neutral-950' : 'text-neutral-400'}`}>💬 Chat</button>
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

                    {/* 4-Box Squad Economics Grid */}
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

                {/* 5v5 Squad Tactical Roster OR 1v1 Rival Details */}
                {myActiveMatch && myActiveMatch.matchType === 'squad' && myActiveMatch.squadData ? (
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

                    {/* Team Alpha (Blue) vs Team Bravo (Red) Columns */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Team Alpha */}
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
                                      <img src={slot.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${slot.codmIgn || 'player'}`} alt="" className="w-6 h-6 rounded-md bg-neutral-800 shrink-0 object-cover" />
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
                                      <button onClick={() => copyRivalIgn(slot.codmIgn || '')} className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white" title="Copy IGN">
                                        <Copy size={11} />
                                      </button>
                                      {isMe && myActiveMatch.status === 'PENDING_OPPONENT_STAKE' && (
                                        <button onClick={() => onSquadLeave?.(myActiveMatch.id)} className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-[9px] border border-rose-500/30 cursor-pointer">
                                          Leave
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    !myActiveMatch.squadData?.slots?.some(s => s.userId === currentUser.id && s.staked) && (
                                      <button onClick={() => onSquadJoin?.(myActiveMatch.id, slot.slotIndex, 'ALPHA')} className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-black text-[9px] uppercase cursor-pointer transition-all">
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

                      {/* Team Bravo */}
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
                                      <img src={slot.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${slot.codmIgn || 'player'}`} alt="" className="w-6 h-6 rounded-md bg-neutral-800 shrink-0 object-cover" />
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
                                      <button onClick={() => copyRivalIgn(slot.codmIgn || '')} className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white" title="Copy IGN">
                                        <Copy size={11} />
                                      </button>
                                      {isMe && myActiveMatch.status === 'PENDING_OPPONENT_STAKE' && (
                                        <button onClick={() => onSquadLeave?.(myActiveMatch.id)} className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 font-bold text-[9px] border border-rose-500/30 cursor-pointer">
                                          Leave
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    !myActiveMatch.squadData?.slots?.some(s => s.userId === currentUser.id && s.staked) && (
                                      <button onClick={() => onSquadJoin?.(myActiveMatch.id, slot.slotIndex, 'BRAVO')} className="px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white font-black text-[9px] uppercase cursor-pointer transition-all">
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
                ) : myActiveMatch ? (
                  /* Rival Player Details & One-Tap Copy Card for Solo 1v1 */
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
                            <img src={rival?.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=rival'} alt="" className="w-10 h-10 rounded-xl bg-neutral-800 shrink-0 object-cover" />
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
                                title="Copy opponent CODM in-game username"
                              >
                                {copiedRivalIgn ? <Check size={14} className="stroke-[3]" /> : <Copy size={14} />}
                                <span>{copiedRivalIgn ? 'IGN Copied!' : 'Copy IGN'}</span>
                              </button>
                              {rival.codmUid && (
                                <button
                                  type="button"
                                  onClick={() => copyRivalUid(rival.codmUid)}
                                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase cursor-pointer flex items-center justify-center gap-1.5 border border-neutral-700 transition-all active:scale-95"
                                  title="Copy opponent CODM UID"
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
                ) : null}

                 {myActiveMatch.status === 'PENDING_OPPONENT_STAKE' && (
                   <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                     <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Share Invite Link</div>
                     <div className="flex gap-2"><input type="text" readOnly value={`${window.location.origin}/?join=${myActiveMatch.id}`} className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-xs text-neutral-400" /><button onClick={() => copyInviteLink(myActiveMatch.id)} className="px-4 py-2 bg-amber-400 text-neutral-950 font-black text-[10px] rounded-lg uppercase cursor-pointer">Copy Link</button></div>
                   </div>
                 )}

                 {['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(myActiveMatch.status) && (
                   <div className="space-y-4">
                     {myActiveMatch.roomGeneratedAt && (
                       <div className="flex items-center justify-between p-3 rounded-xl bg-black border border-neutral-800">
                         <div className="flex items-center gap-2 text-neutral-400 text-[10px] font-bold uppercase tracking-wider"><Clock size={14} className="text-amber-400" /><span>Match Timer:</span><span className={`font-mono text-xs ${isExpired ? 'text-rose-500' : 'text-amber-400'}`}>{timeLeft}</span></div>
                         <button onClick={() => { setAbandonError(null); setShowAbandonModal(true); }} className="text-neutral-500 text-[9px] hover:text-white uppercase font-bold underline cursor-pointer">Settle Abandoned</button>
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
                       <div className="p-5 rounded-2xl bg-rose-950/40 border-2 border-rose-500/60 space-y-4 animate-in zoom-in-95">
                         <div className="flex gap-3"><div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center shrink-0"><AlertTriangle className="text-rose-400" /></div><div><div className="text-sm font-black text-white uppercase">Dispute Detected!</div><p className="text-[11px] text-neutral-400">Conflicting scores. Upload scoreboard screenshot to resolve.</p></div></div>
                         <div className="space-y-3"><input type="file" accept="image/*" className="w-full text-xs text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-rose-500 file:text-white" onChange={e => { const f = e.target.files?.[0]; if(f){ const r=new FileReader(); r.onload=()=>setScreenshotPreview(r.result as string); r.readAsDataURL(f); } }} />{screenshotPreview && <div className="h-40 rounded-xl overflow-hidden border border-rose-500/50 bg-black"><img src={screenshotPreview} className="w-full h-full object-contain" alt="" /></div>}<button onClick={() => handleResultSubmit(myActiveMatch.id)} disabled={isSubmitting || !screenshotPreview} className="w-full py-3 bg-rose-500 text-white font-black rounded-xl text-xs uppercase shadow-xl">{isSubmitting ? 'Verifying...' : 'Submit Proof & Resolve'}</button></div>
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
                                 Your result has been registered. The referee system is waiting for your rival to submit on their screen. Once both players submit, the match will resolve and winner payout (₦{myActiveMatch.winnerPayout.toLocaleString()}) will release immediately!
                               </p>
                             </div>
                           </div>
                         </div>
                       </div>
                     ) : (
                       <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
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

                         <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-neutral-400"><span>Match Ended? Confirm Result</span><span className="text-amber-400">Winner: ₦{myActiveMatch.winnerPayout.toLocaleString()}</span></div>
                         <div className="grid grid-cols-3 gap-2">
                           {(['VICTORY', 'DEFEAT', 'DRAW'] as const).map(claim => (
                             <button key={claim} onClick={() => setSelectedClaim(claim)} className={`py-3 rounded-xl border text-[10px] font-black uppercase transition-all ${selectedClaim === claim ? 'bg-amber-400 text-neutral-950 border-amber-400 shadow-lg' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}>{claim === 'VICTORY' ? 'I Won' : claim === 'DEFEAT' ? 'I Lost' : 'Draw'}</button>
                           ))}
                         </div>
                         <button onClick={() => handleResultSubmit(myActiveMatch.id)} disabled={isSubmitting} className="w-full py-3.5 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs uppercase shadow-xl transition-all active:scale-95">{isSubmitting ? 'Confirming...' : `Submit "${selectedClaim}" Confirmation`}</button>
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
          </div>
        ) : (
          <div className="p-16 rounded-3xl bg-neutral-900 border border-neutral-800 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 text-neutral-500 flex items-center justify-center mx-auto"><Zap size={32} /></div>
            <div className="text-2xl font-black font-heading text-white uppercase">No Active Battle</div>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">You're not currently in a match. Start a new wager or accept a challenge!</p>
            <button onClick={() => setArenaTab('live')} className="px-8 py-3 bg-amber-400 text-neutral-950 font-black rounded-2xl text-xs uppercase shadow-lg">Browse Live Lobby</button>
          </div>
        )
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
      {showAbandonModal && myActiveMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3"><div className="flex items-center gap-2"><AlertTriangle className="text-amber-400" /><span className="text-sm font-black uppercase text-white">Settle Abandoned</span></div><button onClick={() => setShowAbandonModal(false)}><X size={20} className="text-neutral-500" /></button></div>
            {(() => {
              const calc = calculateAbandonedMatchRefund(myActiveMatch.stakeAmount, myActiveMatch.platformFeePercentage);
              return (<div className="space-y-5"><p className="text-xs text-neutral-400">Settle immediately if opponent is AFK. Refunded stake minus 10% penalty.</p><div className="p-4 rounded-xl bg-black space-y-2 text-[11px] font-mono"><div className="flex justify-between text-neutral-500"><span>Stake:</span><span>₦{calc.stakeAmount.toLocaleString()}</span></div><div className="flex justify-between text-rose-500"><span>Penalty:</span><span>-₦{calc.penaltyFee.toLocaleString()}</span></div><div className="pt-2 border-t border-neutral-800 flex justify-between text-emerald-400 font-bold text-xs"><span>Refund:</span><span>₦{calc.refundPerPlayer.toLocaleString()}</span></div></div>{abandonError && <div className="p-3 bg-rose-500/10 text-rose-400 text-[10px] rounded-lg border border-rose-500/20">{abandonError}</div>}<div className="flex gap-3 pt-2"><button onClick={() => setShowAbandonModal(false)} className="flex-1 py-3 bg-neutral-800 text-white font-bold rounded-xl text-xs uppercase">Wait</button><button disabled={isAbandoning} onClick={async () => { setIsAbandoning(true); try { await onAbandonMatch?.(myActiveMatch.id); setShowAbandonModal(false); } catch(err:any){ setAbandonError(err.message); } finally { setIsAbandoning(false); } }} className="flex-1 py-3 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs uppercase shadow-xl">{isAbandoning ? 'Settle...' : 'Confirm Settle'}</button></div></div>);
            })()}
          </div>
        </div>
      )}

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
