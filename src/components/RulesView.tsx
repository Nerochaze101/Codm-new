import React from 'react';
import { ShieldCheck, Swords, Trophy, Camera, AlertTriangle, Scale, CheckCircle2 } from 'lucide-react';

export const RulesView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      {/* Header */}
      <div className="text-center space-y-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
          <ShieldCheck className="w-3.5 h-3.5" />
          Official Fair Play Standards
        </span>
        <h1 className="text-3xl sm:text-4xl font-black font-heading text-white">
          CODM 1v1 ESCROW & VERIFICATION RULES
        </h1>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto">
          Every wager is backed by real-time escrow locked from both players. Learn how matches are tracked, verified, and paid out.
        </p>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pillar 1 */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Swords className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">1. Room Setup & Minimum Stakes</h3>
          <p className="text-xs text-neutral-300 leading-relaxed">
            The minimum stake amount is <strong>₦1,000</strong>. When a match challenge is posted, the creator's ₦1,000 is placed in escrow.
            When the opponent joins, their ₦1,000 is also locked. The platform generates an official tracking Room Code (e.g. <code>CODM-8291-SHP</code>) which both contenders use to identify the match.
          </p>
        </div>

        {/* Pillar 2 */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Scale className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">2. Standard 1v1 Gameplay Rules</h3>
          <ul className="text-xs text-neutral-300 space-y-1.5 list-disc list-inside">
            <li><strong>Sniper 1v1</strong>: Bolt-action and semi-auto sniper rifles only (DL Q33, Locus, Koshka, Arctic.50, Outlaw).</li>
            <li>No secondary pistols or melee weapon kills allowed unless specified.</li>
            <li>No Operator Skills (Purifier, Annihilator, etc.) and no Scorestreaks.</li>
            <li>Match target: First to 10 kills (or 5 round wins in S&D).</li>
          </ul>
        </div>

        {/* Pillar 3 */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Camera className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">3. Result Submission & AI Verification</h3>
          <p className="text-xs text-neutral-300 leading-relaxed">
            At the end of the game, both players must take a clear screenshot of the post-match scoreboard.
            Our automated AI Referee verifies:
          </p>
          <ul className="text-xs text-neutral-400 space-y-1 list-disc list-inside">
            <li>Presence of the golden "VICTORY" or silver "DEFEAT" banner.</li>
            <li>Player In-Game Name (IGN) matching the user's profile.</li>
            <li>Final kill count and scoreline.</li>
          </ul>
        </div>

        {/* Pillar 4 */}
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">4. Payouts & 10% Platform Fee</h3>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Upon verified victory, the total match pot (e.g. ₦2,000) is paid out to the winner minus a 10% platform referee fee (₦200).
            The winner receives <strong>₦1,800</strong> credited directly to their available balance, with zero withdrawal lockouts.
            The loser receives ₦0.
          </p>
        </div>
      </div>

      {/* Dispute Resolution Note */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold font-heading text-base">
          <AlertTriangle className="w-5 h-5" />
          <span>Dispute Guarantee & Fraud Protection</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed">
          If both players claim Victory with fake or doctored screenshots, the escrow remains securely frozen and the match is automatically escalated to human referee adjudication.
          Submitting fraudulent screenshots results in a permanent ban and forfeiture of deposited stakes.
        </p>
      </div>
    </div>
  );
};
