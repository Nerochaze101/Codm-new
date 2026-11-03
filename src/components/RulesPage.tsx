import React from 'react';
import {
  ShieldCheck, Swords, Trophy, Camera, AlertTriangle, Scale,
  CheckCircle2, Lock, Sparkles, Users, Crosshair, ArrowRight, Clock
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { Logo } from './Logo';
import { VideoTutorial } from './VideoTutorial';

interface RulesPageProps {
  onOpenCreateBet: (mode?: string, stake?: number) => void;
  onNavigateToArena: () => void;
}

export const RulesPage: React.FC<RulesPageProps> = ({
  onOpenCreateBet,
  onNavigateToArena,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-[3rem] bg-neutral-900 border-2 border-amber-500/30 p-8 sm:p-12 shadow-2xl text-center space-y-6 group">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-400/[0.02] to-transparent pointer-events-none" />
        
        <div className="flex flex-col items-center space-y-6 relative z-10">
          <div className="w-24 h-24">
            <Logo size={96} glow={true} />
          </div>
          
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <ShieldCheck size={14} className="animate-pulse" />
              <span>Esports Integrity & Escrow Handbook</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black font-heading text-white uppercase tracking-tighter leading-none">
              ARENA <span className="text-amber-400">PROTOCOLS</span>
            </h1>

            <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mx-auto leading-relaxed font-medium">
              Every wager is backed by real-time automated escrow. Learn the tournament rules, weapon loadouts, and AI scoreboard verification protocol.
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onOpenCreateBet('1v1 Sniper Only', 100)}
            className="px-6 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs sm:text-sm uppercase tracking-wide transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
          >
            <Swords className="w-4 h-4 stroke-[2.5]" />
            <span>Create 1v1 Challenge</span>
          </button>

          <button
            onClick={onNavigateToArena}
            className="px-6 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs sm:text-sm transition-all cursor-pointer flex items-center gap-2"
          >
            <span>Go to Battle Lobby</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Step-by-Step On-Demand Escrow Protocol */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-heading font-black text-white uppercase">
              How On-Demand Escrow Staking Works
            </h2>
            <p className="text-xs text-neutral-400">Zero pre-funded balance required to challenge</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-mono font-black text-sm flex items-center justify-center">
              01
            </div>
            <h3 className="font-heading font-bold text-white text-sm uppercase">Host Creates Bet Link (₦0)</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              The host sets their stake (e.g. ₦1,000), game mode, map, and rules. No money is deducted upfront. The system creates a shareable challenge code and link.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 font-mono font-black text-sm flex items-center justify-center">
              02
            </div>
            <h3 className="font-heading font-bold text-white text-sm uppercase">Opponent Accepts & Stakes</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              The opponent opens the challenge link and sends their ₦1,000 stake into escrow to prove acceptance. The host is instantly notified to match the stake.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 font-mono font-black text-sm flex items-center justify-center">
              03
            </div>
            <h3 className="font-heading font-bold text-white text-sm uppercase">Room Number Generated</h3>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Once both stakes are locked in escrow, the platform generates the official in-game CODM Private Room number (e.g. <code>CODM-8291-SHI</code>) for private battle.
            </p>
          </div>
        </div>
      </div>

      {/* 3. New Rule Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Rule 1: Result Verification Protocol */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-amber-500/40 space-y-4 shadow-xl relative overflow-hidden">
          <img src={CODM_IMAGES.rulesFairPlayBg} className="absolute inset-0 w-full h-full object-cover opacity-10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase">
                1. Result Verification Protocol
              </h3>
            </div>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed relative z-10">
            When a match concludes, both players must upload an uncropped end-game scoreboard screenshot or screen recording. Payouts require mutual agreement or automated AI scoreboard validation. Contested results are immediately referred to human referees.
          </p>
        </div>

        {/* Rule 2: Abandoned & Stalled Matches: No Auto-Settlement & Mutual Agreement Policy */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-amber-500/50 space-y-4 shadow-xl relative overflow-hidden">
          <img src={CODM_IMAGES.rulesFairPlayBg} className="absolute inset-0 w-full h-full object-cover opacity-10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase">
                2. Abandoned Matches: Strictly No Auto-Settlement
              </h3>
            </div>
          </div>
          <div className="text-xs text-neutral-300 leading-relaxed relative z-10 space-y-2">
            <p>
              <strong>Strictly No Automated Settlement:</strong> If the countdown timer expires, an opponent goes AFK, or a match stalls, the system does <strong>NOT</strong> automatically settle the wager or award a default win.
            </p>
            <p>
              <strong>No Unilateral Refunds or Timer Restarts:</strong> Neither player can unilaterally claim a refund or restart the match timer.
            </p>
            <p>
              <strong>Mutual Consent Required:</strong> Both players must agree in the arena to either <strong>(a) Restart the match timer</strong> or <strong>(b) Mutually void the match with a 100% full refund</strong>.
            </p>
            <p className="text-neutral-400 text-[11px]">
              If mutual agreement cannot be reached or an opponent is unresponsive, stakes remain locked safely in escrow. Gladiators may submit match recordings to the <strong>Moderator Review Queue</strong> for manual referee investigation.
            </p>
          </div>
        </div>

        {/* Rule 3: Weapon Loadouts & Agreement */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl relative overflow-hidden">
          <img src={CODM_IMAGES.rulesFairPlayBg} className="absolute inset-0 w-full h-full object-cover opacity-10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase">
                3. Weapon Loadouts & Agreement
              </h3>
            </div>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed relative z-10">
            Players are permitted to use any weapon loadout mutually agreed upon by both parties. In the absence of an agreement, these rules apply:
          </p>
          <ul className="space-y-2.5 text-xs text-neutral-300 relative z-10">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Allowed Snipers: DL Q33, Locus, Koshka, Arctic.50, Outlaw.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Restricted: No thermite ammo, no secondary pistols, no melee weapons.</span>
            </li>
          </ul>
        </div>

        {/* Rule 4: AI Scoreboard */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl relative overflow-hidden">
          <img src={CODM_IMAGES.rulesFairPlayBg} className="absolute inset-0 w-full h-full object-cover opacity-10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase">
                4. AI Scoreboard Verification
              </h3>
            </div>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed relative z-10">
            Final results require an end-game scoreboard screenshot for automated AI verification.
          </p>
        </div>

        {/* Rule 5: Dispute Protocol */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl relative overflow-hidden">
          <img src={CODM_IMAGES.rulesFairPlayBg} className="absolute inset-0 w-full h-full object-cover opacity-10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase">
                5. Dispute Protocol
              </h3>
            </div>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed relative z-10">
            Conflicting results freeze the escrow pot for human admin review. Ties/draws result in a 100% stake refund. Screen recordings submitted via Telegram bot or web dashboard are analyzed by referees.
          </p>
        </div>

        {/* Rule 6: Conflict Fraud & Repeat Offense Policy */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-rose-500/50 space-y-4 shadow-xl relative overflow-hidden md:col-span-2">
          <img src={CODM_IMAGES.rulesFairPlayBg} className="absolute inset-0 w-full h-full object-cover opacity-10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-rose-400 uppercase">
                6. Match Conflict Fraud & Repeat Offense Penalty Policy
              </h3>
              <p className="text-xs text-neutral-400">Zero-tolerance policy for dishonest result submissions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative z-10 pt-2">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-400 text-xs uppercase">
                <span className="w-6 h-6 rounded-lg bg-amber-500/20 flex items-center justify-center font-mono">1</span>
                <span>Strike 1: Account Flagging & Probation</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                When a user submits a false victory claim or causes a match conflict for the first time, their account is <strong>automatically flagged</strong>, placed on probation status, and issued an official Telegram warning.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
              <div className="flex items-center gap-2 font-bold text-rose-400 text-xs uppercase">
                <span className="w-6 h-6 rounded-lg bg-rose-500/20 flex items-center justify-center font-mono">2</span>
                <span>Strike 2: Permanent Ban & 100% Fund Forfeiture</span>
              </div>
              <p className="text-xs text-neutral-300 leading-relaxed">
                A <strong>repeat offense</strong> results in an immediate <strong>PERMANENT ACCOUNT BAN</strong>, complete 100% forfeiture of all wallet & escrow balances to ₦0, and permanent blacklisting from the platform, Telegram Bot, and official <strong>@OpsSTAKE</strong> channel.
              </p>
            </div>
          </div>
        </div>
      </div>
      <VideoTutorial 
        title="Video Tutorial: How to Make Screen Recording Proofs" 
        description="Follow this guide to ensure your screen recordings are valid and accepted by our forensic review system."
      />
    </div>
  );
};
