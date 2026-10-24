import React from 'react';
import { UserProfile, Match } from '../types';
import {
  ShieldCheck, Swords, Trophy, ArrowUpRight, Zap, Play, Plus,
  Copy, Check, Film, Target, Crosshair, Users, Sparkles, Flame,
  Share2, Camera, CheckCircle2
} from 'lucide-react';
import { Logo } from './Logo';

interface DashboardProps {
  currentUser: UserProfile;
  matches: Match[];
  onOpenCreateBet: () => void;
  onOpenWallet: () => void;
  onSelectMatch: (matchId: string) => void;
  onJoinMatch: (match: Match) => void;
  onWatchVideo: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  currentUser,
  matches,
  onOpenCreateBet,
  onOpenWallet,
  onSelectMatch,
  onJoinMatch,
  onWatchVideo,
}) => {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);

  const openMatches = matches.filter((m) => m.status === 'PENDING_OPPONENT_STAKE');
  const activeMatches = matches.filter((m) =>
    ['OPPONENT_STAKED_AWAITING_CREATOR', 'READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(m.status)
  );
  const settledMatches = matches.filter((m) => m.status === 'SETTLED');

  const copyRoomCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const winRate =
    currentUser.wins + currentUser.losses > 0
      ? Math.round((currentUser.wins / (currentUser.wins + currentUser.losses)) * 100)
      : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 md:pb-6 animate-in fade-in duration-700">
      {/* 1. Tactical Header with Logo */}
      <header className="flex flex-col sm:flex-row justify-between items-center gap-6 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-400/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="flex items-center gap-6 relative z-10">
          <div className="w-20 h-20 sm:w-24 sm:h-24">
            <Logo size={96} glow={true} />
          </div>
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter leading-none">
              OPS STAKE <span className="text-amber-400">HQ</span>
            </h1>
            <p className="text-neutral-500 text-xs font-black uppercase tracking-[0.3em] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Arena Status: Active
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 relative z-10 w-full sm:w-auto">
          <div className="flex-1 sm:flex-none p-4 px-6 bg-black/60 border border-neutral-800 rounded-3xl space-y-0.5">
             <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Liquid Funds</p>
             <div className="text-xl font-black text-emerald-400 font-mono tracking-tighter">₦{currentUser.balance.toLocaleString()}</div>
          </div>
          <button 
            onClick={onOpenWallet}
            className="p-4 bg-amber-400 hover:bg-amber-300 text-black rounded-3xl shadow-xl shadow-amber-400/10 transition-all active:scale-95 flex items-center justify-center shrink-0"
          >
            <Plus className="w-8 h-8 stroke-[3]" />
          </button>
        </div>
      </header>

      {/* 2. Quick Icon Action Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Action 1: Create 1v1 Bet */}
        <button
          onClick={onOpenCreateBet}
          className="p-6 rounded-[2rem] bg-neutral-900 border border-amber-500/30 hover:border-amber-400 transition-all duration-500 group relative overflow-hidden text-left shadow-xl"
        >
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 duration-700 text-amber-400"><Swords size={120} /></div>
          <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center text-black mb-6 shadow-lg shadow-amber-400/20 group-hover:scale-110 transition-transform">
            <Swords size={28} className="stroke-[2.5]" />
          </div>
          <div className="space-y-1 relative z-10">
            <div className="text-lg font-black text-white uppercase tracking-tight leading-none group-hover:text-amber-400 transition-colors">Host Duel</div>
            <div className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Min ₦1,000 Stake</div>
          </div>
        </button>

        {/* Action 2: Winnings HQ */}
        <div className="p-6 rounded-[2rem] bg-neutral-900 border border-neutral-800 transition-all duration-500 group relative overflow-hidden text-left shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-emerald-400"><Trophy size={120} /></div>
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
            <Trophy size={28} />
          </div>
          <div className="space-y-1 relative z-10">
            <div className="text-lg font-black text-white uppercase tracking-tight leading-none">Net Prize</div>
            <div className="text-xl font-black text-emerald-400 font-mono tracking-tighter">₦{currentUser.totalWinnings.toLocaleString()}</div>
          </div>
        </div>

        {/* Action 3: Combat Stats */}
        <div className="p-6 rounded-[2rem] bg-neutral-900 border border-neutral-800 transition-all duration-500 group relative overflow-hidden text-left shadow-xl">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-blue-400"><Target size={120} /></div>
          <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-6">
            <Flame size={28} />
          </div>
          <div className="space-y-1 relative z-10">
            <div className="text-lg font-black text-white uppercase tracking-tight leading-none">Record</div>
            <div className="text-xl font-black text-white font-mono tracking-tighter flex items-center gap-2">
               <span className="text-emerald-400">{currentUser.wins}W</span>
               <span className="text-neutral-700">/</span>
               <span className="text-rose-500">{currentUser.losses}L</span>
            </div>
          </div>
        </div>

        {/* Action 4: Watch Video Trailer */}
        <button
          onClick={onWatchVideo}
          className="p-6 rounded-[2rem] bg-neutral-900 border border-neutral-800 hover:border-white/20 transition-all duration-500 group relative overflow-hidden text-left shadow-xl"
        >
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-white"><Play size={120} /></div>
          <div className="w-14 h-14 rounded-2xl bg-neutral-800 flex items-center justify-center text-white mb-6 group-hover:bg-white group-hover:text-black transition-all">
            <Play size={28} className="fill-current ml-1" />
          </div>
          <div className="space-y-1 relative z-10">
            <div className="text-lg font-black text-white uppercase tracking-tight leading-none group-hover:translate-x-1 transition-transform">Trailer</div>
            <div className="text-[10px] text-neutral-500 font-black uppercase tracking-widest">Cinema Experience</div>
          </div>
        </button>
      </div>

      {/* 2. Visual 4-Step Escrow Explainer (Icon-Based, Simple, Zero Jargon) */}
      <div className="p-4 sm:p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            How 1v1 Escrow Works
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 font-bold font-mono">
              1
            </div>
            <div>
              <div className="font-bold text-white leading-tight">Stake ₦1,000</div>
              <div className="text-[11px] text-neutral-400">Locked in escrow</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-300 flex items-center justify-center shrink-0 font-bold font-mono">
              2
            </div>
            <div>
              <div className="font-bold text-white leading-tight">Share Room Code</div>
              <div className="text-[11px] text-neutral-400">Opponent accepts</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800/80">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 text-neutral-300 flex items-center justify-center shrink-0 font-bold font-mono">
              3
            </div>
            <div>
              <div className="font-bold text-white leading-tight">1v1 in CODM</div>
              <div className="text-[11px] text-neutral-400">Shipment / Killhouse</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-bold font-mono">
              4
            </div>
            <div>
              <div className="font-bold text-emerald-400 leading-tight">Paid ₦1,800</div>
              <div className="text-[11px] text-neutral-400">Instant AI payout</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Live Matches in Progress (if any) */}
      {activeMatches.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Active Battles ({activeMatches.length})</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeMatches.map((m) => {
              return (
                <div
                  key={m.id}
                  onClick={() => onSelectMatch(m.id)}
                  className="p-4 rounded-2xl bg-neutral-900 border border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer shadow-lg group flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <Swords className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white font-mono-nums">
                          {m.roomCode ? `#${m.roomCode}` : m.challengeCode}
                        </span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                          {m.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400">
                        {m.creator.codmIgn} vs {m.opponent?.codmIgn || 'Opponent'}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-neutral-400 font-mono-nums">POT</div>
                    <div className="text-sm font-black text-amber-400 font-mono-nums">₦{m.potAmount.toLocaleString()}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Open Challenges / Match Lobby (Icon-Focused Cards) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg sm:text-xl font-bold font-heading text-white">
              Open 1v1 Wager Lobby
            </h2>
          </div>

          <button
            onClick={onOpenCreateBet}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Post Bet</span>
          </button>
        </div>

        {openMatches.length === 0 ? (
          <div className="p-8 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-neutral-400 mx-auto">
              <Swords className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">No Open Challenges Yet</h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Create a ₦1,000 bet now. You'll receive a Room Code and share link to invite your opponent.
            </p>
            <button
              onClick={onOpenCreateBet}
              className="px-5 py-2.5 bg-amber-400 text-neutral-950 font-black rounded-xl text-xs hover:bg-amber-300 transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create ₦1,000 Bet</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {openMatches.map((m) => {
              const isCreator = m.creator.id === currentUser.id;
              return (
                <div
                  key={m.id}
                  onClick={() => onSelectMatch(m.id)}
                  className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
                >
                  <div>
                    {/* Top Tag Bar */}
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono-nums text-xs font-bold text-white bg-neutral-800 px-2 py-0.5 rounded-md">
                          {m.roomCode || m.challengeCode}
                        </span>
                        <button
                          onClick={(e) => copyRoomCode(m.roomCode || m.challengeCode, e)}
                          className="p-1 text-neutral-400 hover:text-amber-400 transition-colors"
                          title="Copy code"
                        >
                          {copiedCode === (m.roomCode || m.challengeCode) ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      <span className="text-xs font-mono-nums font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        ₦{m.stakeAmount.toLocaleString()} Stake
                      </span>
                    </div>

                    {/* Contender info */}
                    <div className="flex items-center gap-2.5 mb-3">
                      <img
                        src={m.creator.avatar}
                        alt={m.creator.codmIgn}
                        className="w-10 h-10 rounded-xl object-cover bg-neutral-800"
                        referrerPolicy="no-referrer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold text-white truncate flex items-center gap-1">
                          <span>{m.creator.codmIgn}</span>
                          {isCreator && <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded">You</span>}
                        </div>
                        <div className="text-xs text-neutral-400 flex items-center gap-1 truncate">
                          <Crosshair className="w-3 h-3 text-amber-400" />
                          <span>{m.gameMode} · {m.map}</span>
                        </div>
                      </div>
                    </div>

                    {/* Pot Summary */}
                    <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/80 flex items-center justify-between text-xs">
                      <div className="text-neutral-400">
                        Pot: <strong className="text-amber-400 font-mono-nums">₦{m.potAmount.toLocaleString()}</strong>
                      </div>
                      <div className="text-emerald-400 font-bold font-mono-nums">
                        Winner gets ₦{m.winnerPayout.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Action */}
                  <div className="pt-2 border-t border-neutral-800/80">
                    {isCreator ? (
                      <div className="flex items-center justify-between text-xs text-amber-400">
                        <span>Waiting for rival to join</span>
                        <Share2 className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJoinMatch(m);
                        }}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Swords className="w-4 h-4" />
                        <span>Accept & Stake ₦{m.stakeAmount.toLocaleString()}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Hall of Fame / Recent Settled Payouts */}
      {settledMatches.length > 0 && (
        <div className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold font-heading text-white">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Recently Verified Escrow Payouts</span>
            </div>
          </div>

          <div className="divide-y divide-neutral-800/80">
            {settledMatches.slice(0, 3).map((m) => (
              <div
                key={m.id}
                onClick={() => onSelectMatch(m.id)}
                className="py-2.5 flex items-center justify-between text-xs hover:bg-neutral-800/30 px-2 rounded-lg transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <div>
                    <span className="font-bold text-white">{m.winnerIgn}</span>
                    <span className="text-neutral-400 ml-1.5">won match #{m.roomCode}</span>
                  </div>
                </div>
                <span className="font-bold font-mono-nums text-emerald-400">
                  +₦{m.winnerPayout.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
