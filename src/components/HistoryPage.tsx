import React, { useState } from 'react';
import { UserProfile, Match } from '../types';
import {
  Clock, Trophy, Swords, ShieldCheck, Check, Copy, ArrowRight,
  Filter, AlertCircle, CheckCircle2, XCircle, ArrowUpRight, Flame,
  RefreshCw, Plus
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';

interface HistoryPageProps {
  currentUser: UserProfile;
  matches: Match[];
  onNavigateToArena: () => void;
  onOpenCreateBet: (mode?: string, stake?: number) => void;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({
  currentUser,
  matches,
  onNavigateToArena,
  onOpenCreateBet,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'VICTORIES' | 'DEFEATS' | 'DRAWS' | 'ACTIVE' | 'CANCELLED'>('ALL');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filter matches involving currentUser
  const myMatches = matches.filter(
    (m) => m.creator.id === currentUser.id || m.opponent?.id === currentUser.id
  );

  const filteredMatches = myMatches.filter((m) => {
    const isCreator = m.creator.id === currentUser.id;
    const myClaim = isCreator ? m.creator.resultClaim : m.opponent?.resultClaim;
    const isWinner = m.winnerId === currentUser.id;
    const isDraw = m.status === 'SETTLED' && (!m.winnerId || m.winnerIgn?.includes('DRAW'));
    const isSettled = m.status === 'SETTLED';

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

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER & OVERVIEW STATS                                    */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider font-mono">
            <Clock className="w-4 h-4" />
            <span>Match Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black font-heading text-white mt-1">
            WAGER & DUEL HISTORY
          </h1>
          <p className="text-xs text-neutral-400">
            Complete record of your 1v1 duels, squad matches, and escrow payouts
          </p>
        </div>

        <button
          onClick={() => onOpenCreateBet()}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs sm:text-sm uppercase tracking-wide transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>New Wager</span>
        </button>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <span className="text-[10px] text-neutral-400 font-mono uppercase block">Total Games</span>
          <span className="text-xl sm:text-2xl font-black text-white font-mono-nums mt-0.5 block">{totalMatchesCount}</span>
          <span className="text-[10px] text-neutral-500 font-mono">1v1 & Squad</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <span className="text-[10px] text-emerald-400 font-mono uppercase block">Victories</span>
          <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-nums mt-0.5 block">{victoriesCount}</span>
          <span className="text-[10px] text-emerald-400/80 font-mono">Paid to Wallet</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <span className="text-[10px] text-rose-400 font-mono uppercase block">Defeats</span>
          <span className="text-xl sm:text-2xl font-black text-rose-400 font-mono-nums mt-0.5 block">{defeatsCount}</span>
          <span className="text-[10px] text-neutral-500 font-mono">Settled Matches</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800">
          <span className="text-[10px] text-amber-300 font-mono uppercase block">Draws / Ties</span>
          <span className="text-xl sm:text-2xl font-black text-amber-300 font-mono-nums mt-0.5 block">{drawsCount}</span>
          <span className="text-[10px] text-amber-300/80 font-mono">100% Refunded</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-neutral-900 border border-neutral-800 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-amber-400 font-mono uppercase block">Net Winnings</span>
          <span className="text-xl sm:text-2xl font-black text-amber-400 font-mono-nums mt-0.5 block">
            ₦{currentUser.totalWinnings.toLocaleString()}
          </span>
          <span className="text-[10px] text-amber-400/80 font-mono">Escrow Verified</span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FILTER TABS                                                */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-800 pb-3">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'ALL'
              ? 'bg-amber-400 text-neutral-950 font-black shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          All Matches ({totalMatchesCount})
        </button>

        <button
          onClick={() => setFilter('VICTORIES')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'VICTORIES'
              ? 'bg-emerald-400 text-neutral-950 font-black shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-emerald-400'
          }`}
        >
          <span>🏆 Victories</span>
          <span className="font-mono-nums">({victoriesCount})</span>
        </button>

        <button
          onClick={() => setFilter('DEFEATS')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'DEFEATS'
              ? 'bg-rose-500 text-white font-black shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-rose-400'
          }`}
        >
          <span>❌ Defeats</span>
          <span className="font-mono-nums">({defeatsCount})</span>
        </button>

        <button
          onClick={() => setFilter('DRAWS')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'DRAWS'
              ? 'bg-amber-500 text-neutral-950 font-black shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-amber-300'
          }`}
        >
          <span>⚖️ Draws</span>
          <span className="font-mono-nums">({drawsCount})</span>
        </button>

        <button
          onClick={() => setFilter('ACTIVE')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            filter === 'ACTIVE'
              ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 font-black shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-amber-300'
          }`}
        >
          <span>⚡ Live / In Progress</span>
          <span className="font-mono-nums">({activeCount})</span>
        </button>

        <button
          onClick={() => setFilter('CANCELLED')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            filter === 'CANCELLED'
              ? 'bg-neutral-700 text-white font-black shadow'
              : 'bg-neutral-900 text-neutral-400 hover:text-white'
          }`}
        >
          Cancelled
        </button>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MATCH LEDGER LIST                                          */}
      {/* ------------------------------------------------------------- */}
      {filteredMatches.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
          <div className="w-14 h-14 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center mx-auto">
            <Swords className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-heading font-black text-lg text-white uppercase">No Matches Found in Filter</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto mt-1">
              {filter === 'ALL'
                ? 'You have not participated in any CODM wagers yet. Challenge a rival in a 1v1 duel or squad match!'
                : `No matches match the "${filter.toLowerCase()}" filter criteria.`}
            </p>
          </div>
          <button
            onClick={() => onOpenCreateBet('1v1 Sniper Only', 1000)}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wide cursor-pointer transition-all"
          >
            Create Your First 1v1 Wager
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMatches.map((m) => {
            const isCreator = m.creator.id === currentUser.id;
            const opponentObj = isCreator ? m.opponent : m.creator;
            const isWinner = m.winnerId === currentUser.id;
            const isSettled = m.status === 'SETTLED';
            const isCancelled = m.status === 'CANCELLED';
            const isActive = ['PENDING_OPPONENT', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING'].includes(m.status);

            return (
              <div
                key={m.id}
                className={`p-5 rounded-2xl bg-neutral-900 border transition-all space-y-3.5 shadow-lg ${
                  isSettled && isWinner && !m.winnerIgn?.includes('DRAW')
                    ? 'border-emerald-500/40 bg-gradient-to-r from-emerald-500/5 via-neutral-900 to-neutral-900'
                    : isSettled && m.winnerIgn?.includes('DRAW')
                    ? 'border-amber-500/40 bg-gradient-to-r from-amber-500/5 via-neutral-900 to-neutral-900'
                    : isSettled && !isWinner
                    ? 'border-rose-500/30'
                    : isActive
                    ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/5 via-neutral-900 to-neutral-900'
                    : 'border-neutral-800'
                }`}
              >
                {/* Card Top Row */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/80 pb-3">
                  <div className="flex items-center gap-2">
                    {/* Status Badge */}
                    {isSettled && isWinner && !m.winnerIgn?.includes('DRAW') && (
                      <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-mono text-[11px] font-black tracking-wider flex items-center gap-1">
                        <Trophy className="w-3 h-3" />
                        VICTORY (+₦{m.winnerPayout.toLocaleString()})
                      </span>
                    )}
                    {isSettled && m.winnerIgn?.includes('DRAW') && (
                      <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 font-mono text-[11px] font-black tracking-wider flex items-center gap-1">
                        <span>⚖️</span>
                        <span>DRAW (₦{m.stakeAmount.toLocaleString()} REFUNDED)</span>
                      </span>
                    )}
                    {isSettled && !isWinner && !m.winnerIgn?.includes('DRAW') && (
                      <span className="px-2.5 py-1 rounded-md bg-rose-500/20 border border-rose-500/40 text-rose-400 font-mono text-[11px] font-black tracking-wider flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        DEFEAT (-₦{m.stakeAmount.toLocaleString()})
                      </span>
                    )}
                    {isActive && (
                      <span className="px-2.5 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono text-[11px] font-black tracking-wider flex items-center gap-1 animate-pulse">
                        <Flame className="w-3 h-3" />
                        {m.status === 'PENDING_OPPONENT_STAKE'
                          ? 'WAITING FOR OPPONENT'
                          : m.status === 'OPPONENT_STAKED_AWAITING_CREATOR'
                          ? 'OPPONENT STAKED · AWAITING HOST'
                          : 'LIVE MATCH IN PROGRESS'}
                      </span>
                    )}
                    {isCancelled && (
                      <span className="px-2.5 py-1 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-400 font-mono text-[11px] font-bold">
                        CANCELLED / REFUNDED (₦{m.stakeAmount.toLocaleString()})
                      </span>
                    )}

                    <span className="text-xs text-neutral-400 font-mono">
                      {new Date(m.createdAt).toLocaleDateString()} · {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Room Code Pill */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-800 text-xs">
                    <span className="text-[10px] text-neutral-500 font-mono">{m.roomCode ? 'ROOM:' : 'CHALLENGE:'}</span>
                    <span className="font-mono-nums font-bold text-amber-400">{m.roomCode || m.challengeCode}</span>
                    <button
                      onClick={() => copyCode(m.roomCode || m.challengeCode)}
                      className="text-neutral-400 hover:text-white transition-colors ml-0.5 cursor-pointer"
                      title="Copy code"
                    >
                      {copiedCode === (m.roomCode || m.challengeCode) ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>

                {/* Card Middle Row: Mode, Map, Opponent & Stake */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="font-heading font-black text-sm sm:text-base text-white uppercase tracking-wide">
                      {m.gameMode}
                    </h4>
                    <div className="text-xs text-neutral-400 font-mono flex flex-wrap items-center gap-2">
                      <span>Map: <strong className="text-neutral-200">{m.map}</strong></span>
                      <span>·</span>
                      <span>
                        Opponent: <strong className="text-amber-400">{opponentObj?.codmIgn || 'Waiting for Challenger'}</strong>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right self-end sm:self-center">
                    <div>
                      <div className="text-[10px] text-neutral-400 uppercase font-mono">Stake Held</div>
                      <div className="font-black text-white font-mono-nums text-sm">
                        ₦{m.stakeAmount.toLocaleString()}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] text-neutral-400 uppercase font-mono">Total Pot</div>
                      <div className="font-black text-amber-400 font-mono-nums text-base">
                        ₦{m.potAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Bottom: Quick Actions */}
                {isActive && (
                  <div className="pt-2 border-t border-neutral-800/80 flex justify-end">
                    <button
                      onClick={onNavigateToArena}
                      className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wide transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Open Active Room</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
