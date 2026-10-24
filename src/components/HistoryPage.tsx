import React, { useState } from 'react';
import { UserProfile, Match } from '../types';
import {
  Clock, Trophy, Swords, ShieldCheck, Check, Copy, ArrowRight,
  Filter, AlertCircle, CheckCircle2, XCircle, ArrowUpRight, Flame,
  RefreshCw, Plus, Target, Map as MapIcon, Zap, Shield, Search,
  History as HistoryIcon
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
  const [filter, setFilter] = useState<'ALL' | 'VICTORIES' | 'DEFEATS' | 'DRAWS' | 'ACTIVE' | 'CANCELLED'>('ALL');
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
    
    const matchesSearch = searchQuery === '' || 
      m.challengeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.roomCode && m.roomCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      m.gameMode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.map.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === 'ALL') return true;
    if (filter === 'VICTORIES') return isSettled && isWinner && !isDraw;
    if (filter === 'DEFEATS') return isSettled && !isWinner && !isDraw;
    if (filter === 'DRAWS') return isDraw;
    if (filter === 'ACTIVE') return ['PENDING_OPPONENT', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING'].includes(m.status);
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
  const victoriesCount = myMatches.filter((m) => m.status === 'SETTLED' && m.winnerId === currentUser.id && !isDrawMatch(m)).length;
  const defeatsCount = myMatches.filter((m) => m.status === 'SETTLED' && m.winnerId && m.winnerId !== currentUser.id && !isDrawMatch(m)).length;
  const drawsCount = myMatches.filter((m) => isDrawMatch(m)).length + (currentUser.draws || 0);
  const activeCount = myMatches.filter((m) => ['PENDING_OPPONENT', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING'].includes(m.status)).length;

  if (isMatchesLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8 pb-16">
        <div className="h-64 bg-neutral-900/50 rounded-[2.5rem] animate-pulse border border-neutral-800" />
        <SkeletonLoader count={4} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* 1. HEADER & OVERVIEW STATS (Tactical Card) */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-neutral-900 border-2 border-amber-500/40 p-8 sm:p-12 shadow-2xl group">
        <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none">
          <img src={CODM_IMAGES.cardBgSubtle} alt="" className="w-full h-full object-cover grayscale" />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-black/80" />
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="space-y-4 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3">
               <div className="w-12 h-12 rounded-2xl bg-amber-400 flex items-center justify-center text-black shadow-lg">
                 <HistoryIcon size={28} />
               </div>
               <h1 className="font-heading font-black text-4xl sm:text-5xl text-white tracking-tighter uppercase leading-none">
                 Combat Log
               </h1>
            </div>
            <p className="text-neutral-500 text-sm max-w-lg font-medium leading-relaxed">
              Complete tactical record of your deployments, verified prize settlements, and field duels.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
            {[
              { label: 'Victories', val: victoriesCount, color: 'text-emerald-400', icon: Trophy },
              { label: 'Defeats', val: defeatsCount, color: 'text-rose-500', icon: Target },
              { label: 'Ties', val: drawsCount, color: 'text-amber-300', icon: Shield },
              { label: 'Winnings', val: `₦${currentUser.totalWinnings.toLocaleString()}`, color: 'text-amber-400', icon: Zap },
            ].map((stat, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-black/40 border border-neutral-800 backdrop-blur-md flex flex-col items-center justify-center space-y-1 group/stat hover:border-white/20 transition-all">
                <stat.icon size={16} className={`${stat.color} mb-1 opacity-60 group-hover/stat:opacity-100 group-hover/stat:scale-110 transition-all`} />
                <span className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em]">{stat.label}</span>
                <span className={`text-xl font-black font-mono-nums ${stat.color}`}>{stat.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. FILTER & SEARCH TOOLBAR */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col xl:flex-row gap-6 items-center">
          <div className="relative flex-1 w-full group">
            <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-amber-400 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter by challenge code, map, or game mode..."
              className="w-full bg-black border border-neutral-800 rounded-[1.5rem] pl-16 pr-8 py-5 text-[15px] font-bold text-white focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-400/5 transition-all duration-300 placeholder:text-neutral-800 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[11px]"
            />
          </div>

          <div className="flex flex-wrap p-1.5 bg-black rounded-[1.5rem] border border-neutral-800 w-full xl:w-auto shadow-inner gap-1">
             {[
               { id: 'ALL', label: 'ALL LOGS', count: totalMatchesCount },
               { id: 'VICTORIES', label: 'VICTORIES', color: 'text-emerald-400', icon: Trophy },
               { id: 'ACTIVE', label: 'LIVE', color: 'text-amber-400', icon: Flame },
               { id: 'DRAWS', label: 'DRAWS', color: 'text-amber-200', icon: Shield },
               { id: 'DEFEATS', label: 'DEFEATS', color: 'text-rose-500', icon: Target },
             ].map(t => (
               <button
                 key={t.id}
                 onClick={() => setFilter(t.id as any)}
                 className={`flex-1 sm:flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 ${filter === t.id ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/10 scale-105' : 'text-neutral-500 hover:text-white hover:bg-neutral-800/50'}`}
               >
                 {t.icon && <t.icon size={12} className={filter === t.id ? 'text-black' : t.color} />}
                 <span>{t.label}</span>
                 {t.count !== undefined && <span className={`font-mono text-[9px] ${filter === t.id ? 'text-black/50' : 'text-neutral-700'}`}>[{t.count}]</span>}
               </button>
             ))}
          </div>
        </div>
      </section>

      {/* 3. MATCH INCIDENTS LIST */}
      <div className="grid grid-cols-1 gap-6">
        {filteredMatches.length === 0 ? (
          <div className="p-20 text-center rounded-[3rem] bg-neutral-900 border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center space-y-6">
            <div className="w-24 h-24 rounded-[2rem] bg-neutral-800 flex items-center justify-center text-neutral-600">
              <HistoryIcon size={48} />
            </div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Zero Incidents Detected</h3>
               <p className="text-neutral-500 text-sm font-medium max-w-xs mx-auto">No combat records found matching your current filter protocol.</p>
            </div>
            <button onClick={() => onOpenCreateBet()} className="px-10 py-4 bg-amber-400 text-black font-black uppercase text-xs tracking-widest rounded-2xl shadow-xl shadow-amber-400/10 transition-all hover:bg-amber-300 active:scale-95 flex items-center gap-2">
              <Plus size={18} /> Deploy First Duel
            </button>
          </div>
        ) : (
          filteredMatches.map((m) => {
            const isCreator = m.creator.id === currentUser.id;
            const opponentObj = isCreator ? m.opponent : m.creator;
            const isWinner = m.winnerId === currentUser.id;
            const isSettled = m.status === 'SETTLED';
            const isActive = ['PENDING_OPPONENT', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING'].includes(m.status);
            const isDraw = isSettled && (!m.winnerId || m.winnerIgn?.includes('DRAW'));

            return (
              <div
                key={m.id}
                className={`group relative overflow-hidden rounded-[2.5rem] bg-neutral-900 border-2 transition-all duration-500 shadow-2xl p-8 sm:p-10 flex flex-col lg:flex-row justify-between items-center gap-10 ${
                  isWinner && isSettled && !isDraw ? 'border-emerald-500/40' :
                  isDraw ? 'border-amber-500/40' :
                  isSettled && !isWinner ? 'border-rose-500/20' :
                  isActive ? 'border-amber-400/60 shadow-[0_0_50px_rgba(251,191,36,0.1)]' : 'border-neutral-800'
                }`}
              >
                {/* Background accents */}
                <div className={`absolute top-0 right-0 p-10 opacity-[0.03] group-hover:opacity-[0.06] transition-all duration-700 pointer-events-none ${isWinner && isSettled && !isDraw ? 'text-emerald-400' : isActive ? 'text-amber-400' : 'text-white'}`}>
                  {isWinner && isSettled && !isDraw ? <Trophy size={160} /> : <Target size={160} />}
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 relative z-10 w-full">
                   {/* Mode Icon */}
                   <div className={`w-20 h-20 rounded-[1.5rem] border-2 flex items-center justify-center transition-all duration-500 ${
                     isWinner && isSettled && !isDraw ? 'bg-emerald-500/10 border-emerald-400 text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)]' :
                     isDraw ? 'bg-amber-500/10 border-amber-400 text-amber-400' :
                     isSettled && !isWinner ? 'bg-neutral-800 border-neutral-700 text-neutral-500 opacity-60' :
                     isActive ? 'bg-amber-400 border-black text-black shadow-[0_0_30px_rgba(251,191,36,0.3)] animate-pulse' : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                   }`}>
                      {m.gameMode.includes('Sniper') ? <Target size={32} /> : <Swords size={32} />}
                   </div>

                   <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-3 flex-1">
                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                        <h4 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">{m.gameMode}</h4>
                        <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-colors ${
                          isWinner && isSettled && !isDraw ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                          isDraw ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' :
                          isSettled && !isWinner ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                          isActive ? 'bg-amber-400/20 border-amber-400/40 text-amber-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                        }`}>
                          {isWinner && isSettled && !isDraw ? 'VICTORY SECURED' :
                           isDraw ? 'DRAW SETTLED' :
                           isSettled && !isWinner ? 'DEFEAT RECORDED' :
                           isActive ? 'DEPLOYED / LIVE' : 'CANCELLED'}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                         <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-neutral-800 text-[10px] font-mono">
                           <span className="text-neutral-600">MAP:</span>
                           <span className="text-neutral-200 font-bold">{m.map.toUpperCase()}</span>
                         </div>
                         <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-neutral-800 text-[10px] font-mono">
                           <span className="text-neutral-600">RIVAL:</span>
                           <span className="text-amber-400 font-black">{opponentObj?.codmIgn || 'PENDING...'}</span>
                         </div>
                         <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-neutral-800 text-[10px] font-mono">
                           <span className="text-neutral-600">INCIDENT_ID:</span>
                           <span className="text-neutral-400">#{m.challengeCode}</span>
                           <button onClick={() => copyCode(m.challengeCode)} className="text-neutral-600 hover:text-white transition-colors"><Copy size={12} /></button>
                         </div>
                      </div>

                      <div className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.2em] flex items-center gap-2">
                        <Clock size={12} />
                        DEPLOYED: {new Date(m.createdAt).toLocaleString()}
                      </div>
                   </div>
                </div>

                <div className="flex flex-row lg:flex-col items-center justify-between lg:justify-center gap-6 lg:gap-4 w-full lg:w-48 shrink-0 relative z-10">
                   <div className="text-left lg:text-right w-full">
                      <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.3em] mb-1">Combat Pot</p>
                      <div className={`text-3xl font-black font-mono-nums tracking-tighter ${isWinner && isSettled && !isDraw ? 'text-emerald-400' : 'text-white'}`}>
                        ₦{m.potAmount.toLocaleString()}
                      </div>
                      <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em] mt-1">
                        {isSettled ? 'Settled' : 'In Escrow'}
                      </p>
                   </div>
                   
                   {isActive && (
                     <button
                       onClick={onNavigateToArena}
                       className="w-full px-6 py-4 rounded-2xl bg-amber-400 hover:bg-amber-300 text-black text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-400/10 transition-all active:scale-95 flex items-center justify-center gap-2"
                     >
                       Re-Enter <ArrowRight size={16} />
                     </button>
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

