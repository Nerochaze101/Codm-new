import React, { useState } from 'react';
import { UserProfile, Match } from '../types';
import {
  Clock, Trophy, Swords, ShieldCheck, Check, Copy, ArrowRight,
  Filter, AlertCircle, CheckCircle2, XCircle, ArrowUpRight, Flame,
  RefreshCw, Plus, Target, Map as MapIcon, Zap, Shield, Search,
  History as HistoryIcon, AlertTriangle
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { SkeletonLoader } from './SkeletonLoader';

interface HistoryPageProps {
  currentUser: UserProfile;
  matches: Match[];
  isMatchesLoading?: boolean;
  onNavigateToArena: () => void;
  onOpenCreateBet: (mode?: string, stake?: number) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  currentUser,
  matches,
  isMatchesLoading,
  onNavigateToArena,
  onOpenCreateBet,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'COMPLETED' | 'ACTIVE' | 'DISPUTED' | 'VICTORIES' | 'DEFEATS' | 'DRAWS' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filter matches involving currentUser
  const myMatches = matches.filter(
    (m) => m.creator.id === currentUser.id || m.opponent?.id === currentUser.id
  );

  const filteredMatches = myMatches.filter((m) => {
    const isCreator = m.creator.id === currentUser.id;
    const isWinner = m.winnerId === currentUser.id;
    const isDraw = m.status === 'SETTLED' && (!m.winnerId || m.winnerIgn?.includes('DRAW'));
    const isSettled = m.status === 'SETTLED';
    const isActive = ['PENDING_OPPONENT_STAKE', 'OPPONENT_STAKED_AWAITING_CREATOR', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING'].includes(m.status);
    const isDisputed = m.status === 'DISPUTED' || !!m.reviewerId || (m.creatorScreenshot && m.opponentScreenshot && !isSettled);
    
    const matchesSearch = searchQuery === '' || 
      m.challengeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.roomCode && m.roomCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.gameMode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.map.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'ALL') return true;
    if (filter === 'COMPLETED') return isSettled;
    if (filter === 'ACTIVE') return isActive;
    if (filter === 'DISPUTED') return isDisputed;
    if (filter === 'VICTORIES') return isSettled && isWinner && !isDraw;
    if (filter === 'DEFEATS') return isSettled && !isWinner && !isDraw;
    if (filter === 'DRAWS') return isDraw;
    if (filter === 'CANCELLED') return m.status === 'CANCELLED';
    return true;
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const totalMatchesCount = myMatches.length;
  const isDrawMatch = (m: Match) => m.status === 'SETTLED' && (!m.winnerId || m.winnerIgn?.includes('DRAW'));
  const completedCount = myMatches.filter((m) => m.status === 'SETTLED').length;
  const activeCount = myMatches.filter((m) => ['PENDING_OPPONENT_STAKE', 'OPPONENT_STAKED_AWAITING_CREATOR', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING'].includes(m.status)).length;
  const disputedCount = myMatches.filter((m) => m.status === 'DISPUTED' || !!m.reviewerId).length;
  const victoriesCount = myMatches.filter((m) => m.status === 'SETTLED' && m.winnerId === currentUser.id && !isDrawMatch(m)).length;
  const defeatsCount = myMatches.filter((m) => m.status === 'SETTLED' && m.winnerId && m.winnerId !== currentUser.id && !isDrawMatch(m)).length;
  const drawsCount = myMatches.filter((m) => isDrawMatch(m)).length + (currentUser.draws || 0);

  if (isMatchesLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        <div className="h-40 bg-neutral-900/50 rounded-2xl animate-pulse border border-neutral-800" />
        <SkeletonLoader count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* 1. HEADER & OVERVIEW STATS (Compact Tactical Banner) */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-amber-500/40 p-6 sm:p-8 shadow-2xl">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="space-y-2 text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3">
               <div className="w-10 h-10 rounded-xl bg-amber-400 flex items-center justify-center text-black shadow-md">
                 <HistoryIcon size={22} />
               </div>
               <h1 className="font-heading font-black text-2xl sm:text-3xl text-white tracking-tighter uppercase leading-none">
                 Combat Log
               </h1>
            </div>
            <p className="text-neutral-400 text-xs max-w-lg font-medium">
              Tactical record of deployments, verified prize settlements, and escrow stakes.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full lg:w-auto">
            {[
              { label: 'Victories', val: victoriesCount, color: 'text-emerald-400', icon: Trophy },
              { label: 'Defeats', val: defeatsCount, color: 'text-rose-500', icon: Target },
              { label: 'Ties', val: drawsCount, color: 'text-amber-300', icon: Shield },
              { label: 'Winnings', val: `₦${currentUser.totalWinnings.toLocaleString()}`, color: 'text-amber-400', icon: Zap },
            ].map((stat, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-black/40 border border-neutral-800 flex flex-col items-center justify-center space-y-0.5">
                <stat.icon size={14} className={`${stat.color} mb-0.5`} />
                <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">{stat.label}</span>
                <span className={`text-base font-black font-mono ${stat.color}`}>{stat.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH TOOLBAR */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col xl:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full group">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-amber-400 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by challenge code, map, or game mode..."
              className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-xs font-bold text-white focus:border-amber-400 focus:outline-none transition-all placeholder:text-neutral-600 placeholder:uppercase"
            />
          </div>

          <div className="flex flex-wrap p-1 bg-black rounded-xl border border-neutral-800 w-full xl:w-auto gap-1">
             {[
               { id: 'ALL', label: 'All', count: totalMatchesCount },
               { id: 'COMPLETED', label: 'Completed', color: 'text-emerald-400', count: completedCount },
               { id: 'ACTIVE', label: 'Active', color: 'text-amber-400', count: activeCount, icon: Flame },
               { id: 'DISPUTED', label: 'Disputed', color: 'text-rose-400', count: disputedCount, icon: AlertTriangle },
               { id: 'VICTORIES', label: 'Wins', color: 'text-emerald-400' },
               { id: 'DEFEATS', label: 'Losses', color: 'text-rose-500' },
             ].map(t => (
               <button
                 key={t.id}
                 onClick={() => setFilter(t.id as any)}
                 className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${filter === t.id ? 'bg-amber-400 text-black shadow-md' : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'}`}
               >
                 {t.icon && <t.icon size={11} className={filter === t.id ? 'text-black' : t.color} />}
                 <span>{t.label}</span>
                 {t.count !== undefined && <span className={`font-mono text-[9px] ${filter === t.id ? 'text-black/60' : 'text-neutral-600'}`}>[{t.count}]</span>}
               </button>
             ))}
          </div>
        </div>
      </section>

      {/* 3. MATCH INCIDENTS LIST (Compact & Streamlined Cards) */}
      <div className="grid grid-cols-1 gap-4">
        {filteredMatches.length === 0 ? (
          <div className="p-16 text-center rounded-3xl bg-neutral-900 border border-neutral-800 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-neutral-500">
              <HistoryIcon size={32} />
            </div>
            <div className="space-y-1">
               <h3 className="text-lg font-black text-white uppercase tracking-wide">No Records Found</h3>
               <p className="text-neutral-400 text-xs">No combat records match your current filter protocol.</p>
            </div>
            <button onClick={() => onOpenCreateBet()} className="px-6 py-2.5 bg-amber-400 text-black font-black uppercase text-xs rounded-xl shadow transition-all hover:bg-amber-300 flex items-center gap-2">
              <Plus size={16} /> Deploy First Duel
            </button>
          </div>
        ) : (
          filteredMatches.map((m) => {
            const isCreator = m.creator.id === currentUser.id;
            const opponentObj = isCreator ? m.opponent : m.creator;
            const isWinner = m.winnerId === currentUser.id;
            const isSettled = m.status === 'SETTLED';
            const isActive = ['PENDING_OPPONENT_STAKE', 'OPPONENT_STAKED_AWAITING_CREATOR', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING'].includes(m.status);
            const isDisputed = m.status === 'DISPUTED' || !!m.reviewerId;
            const isDraw = isSettled && (!m.winnerId || m.winnerIgn?.includes('DRAW'));

            return (
              <div
                key={m.id}
                className={`group relative overflow-hidden rounded-2xl bg-neutral-900 border transition-all duration-300 p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 ${
                  isWinner && isSettled && !isDraw ? 'border-emerald-500/40 bg-neutral-900/90' :
                  isDisputed ? 'border-rose-500/50 bg-neutral-900/90' :
                  isDraw ? 'border-amber-500/40' :
                  isSettled && !isWinner ? 'border-neutral-800 opacity-80' :
                  isActive ? 'border-amber-400/60 ring-1 ring-amber-400/20' : 'border-neutral-800'
                }`}
              >
                <div className="flex items-center gap-4 w-full sm:w-auto">
                   {/* Compact Mode Icon */}
                   <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${
                     isWinner && isSettled && !isDraw ? 'bg-emerald-500/10 border-emerald-400/50 text-emerald-400' :
                     isDisputed ? 'bg-rose-500/10 border-rose-400/50 text-rose-400' :
                     isDraw ? 'bg-amber-500/10 border-amber-400/50 text-amber-400' :
                     isSettled && !isWinner ? 'bg-neutral-800 border-neutral-700 text-neutral-500' :
                     isActive ? 'bg-amber-400/20 border-amber-400 text-amber-400 animate-pulse' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                   }`}>
                      {m.gameMode.includes('Sniper') ? <Target size={20} /> : <Swords size={20} />}
                   </div>

                   <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-heading font-black text-sm text-white uppercase tracking-wide truncate">{m.gameMode}</h4>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                          isWinner && isSettled && !isDraw ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                          isDisputed ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
                          isDraw ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' :
                          isSettled && !isWinner ? 'bg-neutral-800 border-neutral-700 text-neutral-400' :
                          isActive ? 'bg-amber-400/20 border-amber-400/40 text-amber-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                        }`}>
                          {isWinner && isSettled && !isDraw ? 'Victory' :
                           isDisputed ? 'Disputed' :
                           isDraw ? 'Draw' :
                           isSettled && !isWinner ? 'Defeated' :
                           isActive ? 'Active Escrow' : 'Cancelled'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-neutral-400">
                         <span>Map: <strong className="text-white">{m.map.toUpperCase()}</strong></span>
                         <span>•</span>
                         <span>Rival: <strong className="text-amber-400">{opponentObj?.codmIgn || 'Pending'}</strong></span>
                         <span>•</span>
                         <span className="text-neutral-500">#{m.challengeCode}</span>
                         <button onClick={() => copyCode(m.challengeCode)} className="text-neutral-500 hover:text-white" title="Copy Code"><Copy size={11} /></button>
                      </div>
                   </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-neutral-800">
                   <div className="text-left sm:text-right">
                      <div className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider">Pot Amount</div>
                      <div className={`text-lg font-black font-mono ${isWinner && isSettled && !isDraw ? 'text-emerald-400' : 'text-white'}`}>
                        ₦{m.potAmount.toLocaleString()}
                      </div>
                   </div>
                   
                   {isActive ? (
                     <button
                       onClick={onNavigateToArena}
                       className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black text-[10px] font-black uppercase tracking-wider shadow transition-all active:scale-95 flex items-center gap-1.5 shrink-0"
                     >
                       <span>Re-Enter</span> <ArrowRight size={14} />
                     </button>
                   ) : isDisputed ? (
                     <button
                       onClick={onNavigateToArena}
                       className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0"
                     >
                       <span>View Dispute</span> <ArrowRight size={14} />
                     </button>
                   ) : (
                     <div className="text-[10px] font-mono text-neutral-500 text-right">
                       {new Date(m.createdAt).toLocaleDateString()}
                     </div>
                   )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
