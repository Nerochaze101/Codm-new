import React, { useState } from 'react';
import { UserProfile, Match } from '../types';
import {
  Swords, ShieldCheck, Trophy, ArrowRight, Zap, Target, Crosshair,
  Flame, CheckCircle2, Wallet, Users, ArrowUpRight, Copy, Check, Sparkles,
  HelpCircle, ChevronDown, ChevronUp, Lock, Banknote, Play, Film,
  UserCheck, AlertCircle, Scale, Clock, RefreshCw
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { calculateMatchEconomics, TIERED_COMMISSION_SCHEDULE } from '../utils/pricing';

export interface LandingPageProps {
  matches: Match[];
  onOpenAuth: (mode?: 'signin' | 'signup') => void;
}

const FAQS = [
  {
    q: 'What is the minimum wager amount?',
    a: 'The minimum stake is ₦1,000. You can also create wagers for ₦2,000, ₦5,000, ₦10,000, ₦25,000, or any custom amount in Nigerian Naira (₦).',
  },
  {
    q: 'How does the escrow protection work?',
    a: 'When you create a challenge, your ₦1,000 stake is instantly deducted and locked in safe escrow. When your opponent accepts the invite link, their ₦1,000 is also locked. The total ₦2,000 pot is held securely until the match ends and results are verified.',
  },
  {
    q: 'What if my opponent is a new user and does not have an account yet?',
    a: 'When your opponent opens your challenge invite link, they will be prompted to enter their CODM Gamer Tag and fund their account with at least ₦1,000. That ₦1,000 is immediately escrowed upon sign-up, seamlessly locking them into the match room.',
  },
  {
    q: 'How are match results verified and paid out?',
    a: 'Both players submit their post-match end-game scoreboard screenshot. Our automated referee engine inspects the victory/defeat banner, player gamer tags, and final score. The winner is automatically paid 90% of the pot (e.g. ₦1,800 on a ₦2,000 pot) directly to their wallet; the loser receives ₦0.',
  },
  {
    q: 'How do I withdraw my winnings to my Nigerian bank account?',
    a: 'You can withdraw instantly from your Wallet Dashboard to any commercial bank in Nigeria (GTBank, Zenith, Access, Kuda, OPay, PalmPay, Moniepoint, etc.) with 0% delay.',
  },
  {
    q: 'What game formats can I create or play?',
    a: 'You can create 1v1 Duels (1v1 Sniper Only on Shipment, 1v1 Gunfight on Killhouse, 1v1 Hardcore FFA on Rust) or Normal Squad Matches (Search & Destroy on Standoff, Hardpoint on Summit, Domination on Firing Range).',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  matches,
  onOpenAuth,
}) => {
  const [activeFormatTab, setActiveFormatTab] = useState<'1v1' | 'normal'>('1v1');
  const [calcStake, setCalcStake] = useState<number>(1000);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Filter open challenges
  const openChallenges = matches.filter(
    (m) => m.status === 'PENDING_OPPONENT_STAKE'
  );

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  const copyRoomCode = (code: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Calculator numbers using Tiered Commission Model
  const { potAmount: calcPot, rakePercentFormatted: calcRakeFormatted, platformFee: calcFee, winnerPayout: calcPayout } = calculateMatchEconomics(calcStake);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col bg-tactical-grid selection:bg-amber-500 selection:text-black">
      {/* 1. DEDICATED PUBLIC LANDING HEADER (NO OVERLAPPING APP DASHBOARD NAVBAR) */}
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Brand Wordmark with Official Emblem */}
          <div className="flex items-center gap-3">
            <img
              src={CODM_IMAGES.appLogo}
              alt="CODM Stake"
              className="w-11 h-11 object-contain drop-shadow-md"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = CODM_IMAGES.appLogoFallback;
              }}
            />
            <div>
              <span className="font-heading font-black text-xl tracking-wide text-white">
                CODM STAKE
              </span>
              <div className="text-[10px] text-neutral-400 font-mono-nums leading-none">
                ESPORTS ESCROW ARENA
              </div>
            </div>
          </div>

          {/* Navigation Anchors */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-semibold text-neutral-300">
            <a href="#formats" className="hover:text-amber-400 transition-colors">
              Battle Formats
            </a>
            <a href="#calculator" className="hover:text-amber-400 transition-colors">
              Wager Calculator
            </a>
            <a href="#how-it-works" className="hover:text-amber-400 transition-colors">
              How Escrow Works
            </a>
            <a href="#faq" className="hover:text-amber-400 transition-colors">
              FAQ
            </a>
          </nav>

          {/* Action CTAs: Sign In & Sign Up */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => onOpenAuth('signin')}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-amber-400 text-neutral-200 hover:text-amber-400 font-bold rounded-xl text-xs sm:text-sm transition-all cursor-pointer"
            >
              <span>Sign In</span>
            </button>
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-4.5 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs sm:text-sm shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>Sign Up</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO PRESENTATION */}
      <section className="relative overflow-hidden py-16 sm:py-24 border-b border-neutral-800/80">
        <div className="absolute inset-0 z-0">
          <img
            src={CODM_IMAGES.heroAction}
            alt="CODM Action Hero"
            className="w-full h-full object-cover object-center opacity-25"
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.target as HTMLImageElement).src = CODM_IMAGES.heroActionFallback;
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/95 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-4xl sm:text-6xl font-black font-heading tracking-wide text-white leading-tight">
              STAKE 1V1 DUELS & <span className="text-amber-400">NORMAL MATCHES</span> WITH ESCROW
            </h1>

            <p className="text-base sm:text-lg text-neutral-300 leading-relaxed max-w-2xl">
              Place wagers starting from <strong>₦1,000</strong>. Challenge rivals in 1v1 Sniper Duels or Squad Formats (Search & Destroy, Hardpoint, Domination).
              Stakes are locked in automated escrow, verified with post-match AI screenshot analysis, and paid out immediately to your Nigerian bank.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <button
                onClick={() => onOpenAuth('signup')}
                className="px-7 py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-2xl text-sm sm:text-base shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Swords className="w-5 h-5 stroke-[2.5]" />
                <span>Create Account & Stake</span>
              </button>

              <button
                onClick={() => onOpenAuth('signin')}
                className="px-6 py-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-amber-400 text-neutral-200 hover:text-white font-bold rounded-2xl text-sm sm:text-base transition-all cursor-pointer flex items-center gap-2"
              >
                <span>Sign In</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Trust Markers Grid */}
            <div className="pt-8 border-t border-neutral-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="text-neutral-400 text-[11px]">Minimum Stake</div>
                <div className="text-lg font-black text-white font-mono-nums mt-0.5">₦1,000</div>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="text-neutral-400 text-[11px]">Platform Fee</div>
                <div className="text-lg font-black text-amber-400 font-mono-nums mt-0.5">10% Rake</div>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="text-neutral-400 text-[11px]">Escrow Protection</div>
                <div className="text-lg font-black text-emerald-400 mt-0.5">100% Guaranteed</div>
              </div>
              <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800">
                <div className="text-neutral-400 text-[11px]">Payout Speed</div>
                <div className="text-lg font-black text-white mt-0.5">Instant Automated</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. INTERACTIVE WAGER CALCULATOR */}
      <section id="calculator" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-b border-neutral-800/80">
        <div className="p-8 sm:p-10 rounded-3xl bg-neutral-900/70 border border-neutral-800 relative overflow-hidden">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <Scale className="w-3.5 h-3.5" />
              <span>Transparent Math & Escrow Guarantee</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-black font-heading text-white">
              INTERACTIVE WAGER & PAYOUT CALCULATOR
            </h2>

            <p className="text-xs sm:text-sm text-neutral-300">
              See exact numbers before you stake. 100% transparent: minimum stake is ₦1,000, 10% platform rake on the total pot, winner takes 90%, loser gets ₦0.
            </p>

            {/* Quick Stake Preset Buttons */}
            <div>
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 block">
                Choose Stake Amount (Minimum ₦1,000):
              </label>
              <div className="flex flex-wrap gap-2">
                {[1000, 2000, 5000, 10000, 25000, 50000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCalcStake(amt)}
                    className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-mono-nums font-bold transition-all cursor-pointer ${
                      calcStake === amt
                        ? 'bg-amber-400 text-neutral-950 font-black shadow-lg scale-105'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                    }`}
                  >
                    ₦{amt.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Numbers Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-neutral-800 text-center">
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Your Stake</div>
                <div className="text-xl sm:text-2xl font-black text-white font-mono-nums mt-1">
                  ₦{calcStake.toLocaleString()}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Total Pot Held</div>
                <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono-nums mt-1">
                  ₦{calcPot.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-500">2x Players</div>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800">
                <div className="text-[11px] text-neutral-400">Tiered Rake ({calcRakeFormatted})</div>
                <div className="text-xl sm:text-2xl font-black text-rose-400 font-mono-nums mt-1">
                  -₦{calcFee.toLocaleString()}
                </div>
                <div className="text-[10px] text-neutral-500">Referee & escrow</div>
              </div>

              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/40">
                <div className="text-[11px] text-emerald-400 font-bold uppercase">Winner Payout</div>
                <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono-nums mt-1">
                  ₦{calcPayout.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-400/80">Credited to wallet</div>
              </div>
            </div>

            {/* Transparent Tiered Commission Model Schedule Table */}
            <div className="pt-6 border-t border-neutral-800/80 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-neutral-300 font-bold uppercase">Tiered Commission Schedule</span>
                <span className="text-amber-400 font-bold">10% Down to 5% Rake</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950">
                <table className="w-full text-left text-xs font-mono-nums">
                  <thead className="bg-neutral-900/80 text-[10px] uppercase font-mono text-neutral-400 border-b border-neutral-800">
                    <tr>
                      <th className="p-3">Stake / Player</th>
                      <th className="p-3">Total Pot</th>
                      <th className="p-3">Rake %</th>
                      <th className="p-3">Platform Fee</th>
                      <th className="p-3 text-emerald-400">Winner Payout</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/80 text-neutral-300">
                    {TIERED_COMMISSION_SCHEDULE.map((item) => (
                      <tr
                        key={item.stake}
                        className={`hover:bg-neutral-900/50 transition-colors ${
                          calcStake === item.stake ? 'bg-amber-500/10 font-bold text-white' : ''
                        }`}
                      >
                        <td className="p-3 font-bold text-amber-400">₦{item.stake.toLocaleString()}</td>
                        <td className="p-3">₦{item.pot.toLocaleString()}</td>
                        <td className="p-3 font-bold text-amber-300">{item.rakePercentFormatted}</td>
                        <td className="p-3 text-rose-400">₦{item.platformFee.toLocaleString()}</td>
                        <td className="p-3 font-bold text-emerald-400">₦{item.winnerPayout.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Core Operating Rules */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <div className="font-bold text-amber-400 font-mono text-[11px] uppercase">1. Single Deductions</div>
                <p className="text-[11px] text-neutral-400">Rake is taken automatically from pooled escrow balance before sending winner payout.</p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <div className="font-bold text-emerald-400 font-mono text-[11px] uppercase">2. Draw Protection</div>
                <p className="text-[11px] text-neutral-400">If players tie, 100% of stakes are returned to both wallets without platform fees.</p>
              </div>

              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 space-y-1">
                <div className="font-bold text-rose-400 font-mono text-[11px] uppercase">3. Fraud Recovery</div>
                <p className="text-[11px] text-neutral-400">Fake scoreboard attempts forfeit 100% of stake as penalty to compensate winner.</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => onOpenAuth('signup')}
                className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs sm:text-sm shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <Swords className="w-4 h-4" />
                <span>Sign Up to Stake ₦{calcStake.toLocaleString()}</span>
              </button>

              <button
                onClick={() => onOpenAuth('signin')}
                className="px-5 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs sm:text-sm transition-colors cursor-pointer"
              >
                <span>Sign In →</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. BATTLE FORMATS SECTION: SOLO (1V1) & SQUAD (TEAM) */}
      <section id="formats" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8 border-b border-neutral-800/80">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            Betting Formats
          </span>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            CHOOSE YOUR BETTING OPTION
          </h2>
          <p className="text-xs sm:text-sm text-neutral-400">
            Select between direct Solo 1v1 duels or Squad Team battles with secure escrow protection.
          </p>
        </div>

        {/* 2 Card Betting Options: Solo (1v1) & Squad (Team) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Card 1: Solo (1v1) */}
          <div className="p-8 rounded-3xl bg-neutral-900 border-2 border-amber-500/50 hover:border-amber-400 transition-all space-y-6 relative overflow-hidden group shadow-2xl">
            <div className="absolute inset-0 z-0">
              <img
                src={CODM_IMAGES.shipment1v1}
                alt="Solo 1v1"
                className="w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = CODM_IMAGES.shipment1v1Fallback;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/90 to-transparent" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg">
                  <Crosshair className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold">
                  SOLO · 1V1 DUEL
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white font-heading tracking-wide">
                  SOLO 1V1 WAGER
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mt-2">
                  Direct head-to-head match against a single opponent. Set your own rules (e.g. 1v1 Sniper Only on Shipment, Gunfight on Killhouse) and lock stake in escrow.
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-800 flex items-center justify-between text-xs font-mono-nums">
                <span className="text-neutral-400">Min Stake: ₦1,000</span>
                <span className="text-emerald-400 font-bold">100% Escrow Protected</span>
              </div>
            </div>

            <div className="relative z-10 pt-2">
              <button
                onClick={() => onOpenAuth('signup')}
                className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-2xl text-sm shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 uppercase"
              >
                <Swords className="w-4 h-4 stroke-[2.5]" />
                <span>Create Solo 1v1 Bet (Sign Up)</span>
              </button>
            </div>
          </div>

          {/* Card 2: Squad (Team) */}
          <div className="p-8 rounded-3xl bg-neutral-900 border-2 border-emerald-500/50 hover:border-emerald-400 transition-all space-y-6 relative overflow-hidden group shadow-2xl">
            <div className="absolute inset-0 z-0">
              <img
                src={CODM_IMAGES.squadTactical}
                alt="Squad Team"
                className="w-full h-full object-cover opacity-20 group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = CODM_IMAGES.squadTacticalFallback;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/90 to-transparent" />
            </div>

            <div className="relative z-10 space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg">
                  <Users className="w-6 h-6 stroke-[2.5]" />
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold">
                  SQUAD · TEAM BATTLE
                </span>
              </div>

              <div>
                <h3 className="text-2xl font-black text-white font-heading tracking-wide">
                  SQUAD TEAM WAGER
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mt-2">
                  Tactical team vs team or clan match (e.g. Search & Destroy on Standoff, Hardpoint on Summit, Domination). Stake funds securely in escrow.
                </p>
              </div>

              <div className="pt-4 border-t border-neutral-800 flex items-center justify-between text-xs font-mono-nums">
                <span className="text-neutral-400">Min Stake: ₦1,000</span>
                <span className="text-emerald-400 font-bold">Instant Payouts</span>
              </div>
            </div>

            <div className="relative z-10 pt-2">
              <button
                onClick={() => onOpenAuth('signup')}
                className="w-full py-4 bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-black rounded-2xl text-sm shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center justify-center gap-2 uppercase"
              >
                <Users className="w-4 h-4 stroke-[2.5]" />
                <span>Create Squad Team Bet (Sign Up)</span>
              </button>
            </div>
          </div>
        </div>
      </section>



      {/* 6. HOW ESCROW WORKS (ARCHITECTURE) */}
      <section id="how-it-works" className="bg-neutral-900/50 border-b border-neutral-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Zero-Trust Financial Protection
            </span>
            <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
              HOW ESCROW GUARANTEES FAIR PLAY
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400">
              Never get scammed after a game. Both players lock their money before the room starts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-black font-mono">
                01
              </div>
              <h4 className="text-base font-bold text-white">Generate Bet Link (₦0 Upfront)</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Set your stake amount (₦1,000+), game mode, and map. Creating your challenge link is free with zero balance held upfront.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 text-neutral-200 flex items-center justify-center font-black font-mono">
                02
              </div>
              <h4 className="text-base font-bold text-white">Opponent Accepts & Stakes</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                Send the challenge link. Your opponent accepts the duel by depositing their stake into escrow to lock their commitment.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 text-neutral-200 flex items-center justify-center font-black font-mono">
                03
              </div>
              <h4 className="text-base font-bold text-white">Host Stakes ➔ Room # Generated</h4>
              <p className="text-xs text-neutral-400 leading-relaxed">
                You send your matching stake into escrow. Once confirmed, the system immediately generates your official in-game CODM Room Number!
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black font-mono">
                04
              </div>
              <h4 className="text-base font-bold text-emerald-400">Battle & AI Escrow Payout</h4>
              <p className="text-xs text-neutral-300 leading-relaxed">
                Join private match in CODM. Upload victory scoreboard screenshot for automated referee verification & instant payout!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQ SECTION */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8 border-b border-neutral-800/80">
        <div className="text-center space-y-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            Common Questions
          </span>
          <h2 className="text-3xl sm:text-4xl font-black font-heading text-white">
            FREQUENTLY ASKED QUESTIONS
          </h2>
        </div>

        <div className="space-y-3">
          {FAQS.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-neutral-900 border border-neutral-800 overflow-hidden"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left flex items-center justify-between text-sm font-bold text-white hover:text-amber-400 transition-colors cursor-pointer"
              >
                <span>{item.q}</span>
                {openFaq === idx ? <ChevronUp className="w-4 h-4 text-amber-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs text-neutral-300 leading-relaxed border-t border-neutral-800/80 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 8. BOTTOM CALL TO ACTION BANNER */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/40 border border-amber-500/40 text-center space-y-6 shadow-2xl">
          <h2 className="text-3xl sm:text-5xl font-black font-heading text-white">
            READY TO STAKE YOUR FIRST MATCH?
          </h2>
          <p className="text-sm text-neutral-300 max-w-xl mx-auto">
            Fund your wallet with ₦1,000, create your custom battle room, and invite your opponent. Instant escrow, fair play guaranteed.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => onOpenAuth('signup')}
              className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-2xl text-base shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <span>Create Account (Sign Up)</span>
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </button>

            <button
              onClick={() => onOpenAuth('signin')}
              className="px-7 py-4 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white font-bold rounded-2xl text-base transition-all cursor-pointer flex items-center gap-2"
            >
              <span>Sign In to Account</span>
            </button>
          </div>
        </div>
      </section>

      {/* 9. PUBLIC DEDICATED FOOTER */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-8 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="font-heading font-black text-white tracking-wider">CODM STAKE 1V1</span>
            <span>·</span>
            <span>Independent Esports Escrow Platform · Nigeria (₦)</span>
          </div>
          <div className="flex items-center gap-4">
            <span>Call of Duty: Mobile is a trademark of Activision</span>
            <span>·</span>
            <span>10% Platform Rake</span>
            <span>·</span>
            <button onClick={() => onOpenAuth('signin')} className="text-amber-400 hover:underline cursor-pointer">
              Sign In
            </button>
            <span>·</span>
            <button onClick={() => onOpenAuth('signup')} className="text-neutral-400 hover:text-white hover:underline cursor-pointer">
              Create Account
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
