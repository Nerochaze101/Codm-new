import React from 'react';
import {
  ShieldCheck, Swords, Trophy, Camera, AlertTriangle, Scale,
  CheckCircle2, Lock, Sparkles, Users, Crosshair, ArrowRight
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';

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
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-amber-500/40 p-6 sm:p-10 shadow-2xl text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4" />
          <span>Official Esports Integrity & Escrow Handbook</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black font-heading text-white uppercase tracking-wide">
          CODM 1V1 FAIR PLAY & RULES
        </h1>

        <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl mx-auto leading-relaxed">
          Every wager is backed by real-time automated escrow. Learn the tournament rules, allowed sniper weapons, prohibited tactics, and AI scoreboard verification protocol.
        </p>

        <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => onOpenCreateBet('1v1 Sniper Only', 1000)}
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

      {/* 3. 1v1 Sniper Weapon Rules & Prohibited Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Allowed Weapons */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Crosshair className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase">
                Allowed Sniper Weapons (1v1 Duel)
              </h3>
              <p className="text-xs text-neutral-400">Standard competitive sniper loadouts</p>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs text-neutral-300">
            <li className="flex items-start gap-2 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>DL Q33</strong> — Standard default sniper rifle for all 1v1 duels.</span>
            </li>
            <li className="flex items-start gap-2 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Locus</strong> & <strong>Koshka</strong> — Allowed with standard attachments (no thermite ammo).</span>
            </li>
            <li className="flex items-start gap-2 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span><strong>Arctic.50</strong> & <strong>Outlaw</strong> — Permitted for fast quickscopes.</span>
            </li>
          </ul>
        </div>

        {/* Banned Elements */}
        <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-heading font-black text-white uppercase">
                Banned Equipment & Disqualifications
              </h3>
              <p className="text-xs text-neutral-400">Strictly prohibited in competitive 1v1 wagers</p>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs text-neutral-300">
            <li className="flex items-start gap-2 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">✕</span>
              <span><strong>No Secondary Pistols or Melee Weapons</strong> (Shorty, Katana, Kali Sticks, etc.).</span>
            </li>
            <li className="flex items-start gap-2 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">✕</span>
              <span><strong>No Scorestreaks or Operator Skills</strong> (UAV, Shock RC, Annihilator, Purifier).</span>
            </li>
            <li className="flex items-start gap-2 p-2.5 rounded-xl bg-neutral-950/80 border border-neutral-800">
              <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">✕</span>
              <span><strong>No Glitching or Out-of-Bounds Exploits</strong> on Shipment or Killhouse.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 4. AI Referee Scoreboard Verification Process */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Camera className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg sm:text-xl font-heading font-black text-white uppercase">
              AI Scoreboard Inspection & Payout Protocol
            </h3>
            <p className="text-xs text-neutral-400">Automated verification for instant payouts</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="font-bold text-amber-400 font-mono uppercase">1. Clear Scoreboard Screenshot</div>
            <p className="text-neutral-400 leading-relaxed">
              Capture the end-game scoreboard displaying the gold "VICTORY" or silver "DEFEAT" banner with both player IGNs visible.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="font-bold text-amber-400 font-mono uppercase">2. AI Vision Verification</div>
            <p className="text-neutral-400 leading-relaxed">
              Our automated referee scans the kill breakdown, victory banner, and gamer tag to confirm the legitimate winner.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="font-bold text-emerald-400 font-mono uppercase">3. Instant Escrow Payout</div>
            <p className="text-neutral-400 leading-relaxed">
              The full pot (minus standard 10% platform fee) is immediately released to the winner with zero delay.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Dispute Protection Guarantee */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-amber-500/10 via-neutral-900 to-neutral-900 border border-amber-500/40 space-y-3 shadow-xl">
        <div className="flex items-center gap-2.5 text-amber-400 font-heading font-black text-base uppercase">
          <Scale className="w-5 h-5" />
          <span>Dispute Adjudication & 100% Escrow Refund Policy</span>
        </div>
        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
          If both players disagree or submit conflicting screenshots, the escrow pot is immediately frozen and assigned to human esports admins for manual match log review. If a match ends in a mutual tie or draw, <strong>100% of all deposited stakes</strong> are automatically refunded to both players.
        </p>
      </div>
    </div>
  );
};
