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
  onCreateBet: (data: { stakeAmount: number; gameMode: string; map: string; rules: string[]; matchDurationMinutes?: number; isPublic?: boolean }) => Promise<void>;
  onOpenCreateBet?: (mode?: string, stake?: number) => void;
  onJoinMatch: (matchId: string, opponentId: string) => Promise<void>;
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
  currentUser, matches, isMatchesLoading, onCreateBet, onJoinMatch, onOpponentStake, onCreatorStake,
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
  const myActiveMatch = matches.find(m => (m.creator.id === currentUser.id || m.opponent?.id === currentUser.id) && activeStatuses.includes(m.status));
  const [arenaTab, setArenaTab] = useState<'live' | 'active' | 'hosted'>(() => myActiveMatch ? 'active' : 'live');

  const [showTelegramConnectPopup, setShowTelegramConnectPopup] = useState<boolean>(false);
  const [botUsername, setBotUsername] = useState<string>('OpsSTAKEBOT');

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
            <div className="p-4 rounded-2xl bg-neutral-900 border-2 border-amber-400 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-neutral-950 flex items-center justify-center font-black"><Zap size={20} /></div>
                <div>
                  <div className="text-xs font-black text-amber-400 uppercase tracking-widest">Active Battle In Progress</div>
                  <p className="text-sm font-bold text-white">Vs {isCreatorOfActive ? (myActiveMatch.opponent?.codmIgn || 'Opponent') : myActiveMatch.creator.codmIgn}</p>
                </div>
              </div>
              <button onClick={() => setArenaTab('active')} className="w-full sm:w-auto px-6 py-2.5 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2">Open Match Room <ArrowRight size={16} /></button>
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
                  {filteredChallenges.map(m => (
                    <div key={m.id} className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-amber-400/40 transition-all flex flex-col justify-between shadow-lg">
                      <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">#{m.challengeCode}</span><span className="text-xs font-black text-emerald-400">₦{m.stakeAmount.toLocaleString()}</span></div>
                      <div className="flex items-center gap-2.5"><img src={m.creator.avatar} alt="" className="w-8 h-8 rounded-lg bg-neutral-800" /><div className="min-w-0 flex-1"><div className="text-xs font-bold text-white truncate">{m.creator.codmIgn}</div><div className="text-[10px] text-neutral-400 truncate">{m.gameMode} · {m.map}</div></div></div>
                      <button onClick={() => { setStakeTargetMatch(m); setStakeRole('opponent'); setIsStakeModalOpen(true); }} className="w-full mt-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-black rounded-lg text-[10px] uppercase cursor-pointer">Accept Duel</button>
                    </div>
                  ))}
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
              <div className="flex items-center gap-3"><div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /><span>{myActiveMatch.status.replace(/_/g, ' ')}</span></div><span className="text-xs font-bold text-white">{myActiveMatch.gameMode}</span></div>
              <div className="flex items-center gap-2"><div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black border border-neutral-800"><span className="text-[10px] text-neutral-400 font-mono">CODE:</span><span className="text-xs font-black text-amber-400">{myActiveMatch.roomCode || myActiveMatch.challengeCode}</span><button onClick={() => copyCode(myActiveMatch.roomCode || myActiveMatch.challengeCode)} className="text-neutral-500 ml-1 hover:text-white"><Copy size={12} /></button></div><div className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold">Pot: ₦{myActiveMatch.potAmount.toLocaleString()}</div></div>
            </div>

            <div className="relative z-10 flex lg:hidden rounded-xl bg-neutral-950 p-1 border border-neutral-800">
              <button onClick={() => setActiveMatchSubTab('game')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg ${activeMatchSubTab === 'game' ? 'bg-amber-400 text-neutral-950' : 'text-neutral-400'}`}>🎮 Game</button>
              <button onClick={() => setActiveMatchSubTab('chat')} className={`flex-1 py-2 text-xs font-black uppercase rounded-lg ${activeMatchSubTab === 'chat' ? 'bg-amber-400 text-neutral-950' : 'text-neutral-400'}`}>💬 Chat</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
              <div className={`lg:col-span-2 space-y-4 ${activeMatchSubTab === 'chat' ? 'hidden lg:block' : 'block'}`}>
                 <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs font-bold text-amber-400 flex justify-between items-center">
                    <div className="flex items-center gap-2"><Clock size={16} className="animate-pulse" /><span>{myActiveMatch.roomCode ? `Battle Room Ready (#${myActiveMatch.roomCode})` : 'Awaiting Opponent to Accept'}</span></div>
                    <span className="text-emerald-400">Winner Payout: ₦{myActiveMatch.winnerPayout.toLocaleString()}</span>
                 </div>

                 {/* Rival Player Details & One-Tap Copy Card */}
                 {myActiveMatch && (
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
                 )}

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

                         <div className="pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
                           <span>Testing on single device?</span>
                           <button
                             type="button"
                             onClick={() => handleResultSubmit(myActiveMatch.id, (isCreatorOfActive ? myActiveMatch.creator.resultClaim : myActiveMatch.opponent?.resultClaim) === 'VICTORY' ? 'DEFEAT' : 'VICTORY')}
                             className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                           >
                             Simulate Rival Confirmation
                           </button>
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
              {myHostedBets.map(m => (
                <div key={m.id} className="p-5 rounded-2xl bg-neutral-900 border border-amber-500/30 space-y-4">
                  <div className="flex justify-between items-center"><span className="text-xs font-mono font-bold text-amber-400">#CHALLENGE_{m.challengeCode}</span><span className="text-sm font-black text-emerald-400">₦{m.stakeAmount.toLocaleString()}</span></div>
                  <div className="text-sm font-bold text-white uppercase">{m.gameMode} · {m.map}</div>
                  <div className="flex gap-2 pt-2"><button onClick={() => copyInviteLink(m.id)} className="flex-1 py-2 bg-neutral-800 text-white font-bold rounded-xl text-[10px] uppercase">Copy Link</button><button onClick={() => onCancelMatch(m.id)} className="px-4 py-2 bg-rose-500/20 text-rose-400 font-bold rounded-xl text-[10px] uppercase border border-rose-500/40">Cancel</button></div>
                </div>
              ))}
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

      {/* Telegram Bot Connect Popup Modal */}
      {showTelegramConnectPopup && !currentUser.telegramChatId && currentUser.id !== 'guest' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-neutral-900 border-2 border-amber-400/60 rounded-3xl p-6 shadow-2xl space-y-5 overflow-hidden">
            {/* Background ambient glow */}
            <div className="absolute -right-16 -top-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -left-16 -bottom-16 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Cancel / Close button */}
            <button
              onClick={() => setShowTelegramConnectPopup(false)}
              className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-xl transition-colors cursor-pointer"
              title="Close / Cancel"
            >
              <X size={20} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 text-white flex items-center justify-center font-bold shadow-lg shadow-sky-500/20 shrink-0">
                <MessageCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="text-[11px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles size={12} /> Tactical Live Alerts
                </div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight font-heading">Connect Telegram Bot</h3>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-neutral-300 leading-relaxed bg-neutral-950/60 p-3.5 rounded-2xl border border-neutral-800">
              Connect your account to the official Telegram Bot to receive real-time notifications for <b>wager accepts</b>, <b>in-game room codes</b>, and <b>instant cashout alerts</b>.
            </p>

            {/* Official Channel Banner */}
            <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-sky-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping shrink-0" />
                <div className="text-xs">
                  <div className="text-neutral-400 font-medium">Official Channel</div>
                  <div className="font-bold text-sky-400">@OpsSTAKE</div>
                </div>
              </div>
              <a
                href="https://t.me/OpsSTAKE"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-300 text-xs font-bold rounded-xl transition-all flex items-center gap-1 shrink-0"
              >
                Join <ExternalLink size={12} />
              </a>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-1">
              <a
                href={`https://t.me/${botUsername}?start=link_${currentUser.id}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowTelegramConnectPopup(false)}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Zap size={16} fill="black" /> 1-Tap Connect Bot Now
              </a>

              <button
                onClick={() => setShowTelegramConnectPopup(false)}
                className="w-full py-3 px-4 bg-neutral-800/80 hover:bg-neutral-800 text-neutral-400 hover:text-white font-bold text-xs uppercase rounded-2xl transition-colors cursor-pointer border border-neutral-700/50"
              >
                Skip / Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
