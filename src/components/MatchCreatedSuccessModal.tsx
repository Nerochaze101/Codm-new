import React, { useState } from 'react';
import { Match } from '../types';
import {
  X, CheckCircle2, Users, Trophy, ShieldCheck, Copy, Check,
  Share2, ArrowRight, Zap, Flame, Award
} from 'lucide-react';

interface MatchCreatedSuccessModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenMatchRoom: (matchId: string) => void;
}

export const MatchCreatedSuccessModal: React.FC<MatchCreatedSuccessModalProps> = ({
  match,
  isOpen,
  onClose,
  onOpenMatchRoom,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !match) return null;

  const isSquad = match.matchType === 'squad' || Boolean(match.squadData);
  const squadSlots = match.squadData?.slots || [];
  const filledSlots = squadSlots.filter((s: any) => s.staked).length || 1;
  const openSlots = Math.max(0, 10 - filledSlots);

  // Exact economics
  const stake = match.stakeAmount;
  const grossPot = match.potAmount;
  const feePercent = match.platformFeePercentage || (isSquad ? 5 : 10);
  const platformFee = match.platformFee !== undefined
    ? match.platformFee
    : Math.round(grossPot * (feePercent / 100));
  const netPool = grossPot - platformFee;
  const winnerPayout = match.winnerPayout || (isSquad ? Math.floor(netPool / 5) : netPool);

  const inviteUrl = `${window.location.origin}/?join=${match.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(match.challengeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border-2 border-emerald-500/60 rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              {isSquad ? <Users size={22} /> : <Zap size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {isSquad ? '5v5 Squad Wager Created' : '1v1 Match Challenge Created'}
                </span>
                <span className="text-xs font-mono font-bold text-amber-400">#{match.challengeCode}</span>
              </div>
              <h2 className="text-lg font-black text-white font-heading uppercase mt-0.5">
                {isSquad ? 'Squad Escrow Locked!' : 'Wager Deployed to Arena!'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-neutral-800/80 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* HERO EXACT PAYOUT SHOWCASE BOX */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-950/60 via-neutral-950 to-neutral-900 border-2 border-emerald-400/50 shadow-xl space-y-2 text-center relative z-10">
          <div className="text-[11px] font-black uppercase tracking-widest text-emerald-300 font-sans flex items-center justify-center gap-1.5">
            <Trophy size={16} className="text-amber-400 animate-bounce" />
            <span>{isSquad ? 'Exact Payout Per Winning Player' : 'Exact Winner Cashout'}</span>
          </div>
          <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight flex items-baseline justify-center gap-1.5">
            <span>₦{winnerPayout.toLocaleString()}</span>
            {isSquad && <span className="text-xs font-sans text-neutral-400 font-medium">/ player</span>}
          </div>
          {isSquad ? (
            <p className="text-xs text-neutral-300 font-sans">
              All <strong className="text-white">5 players</strong> on the winning squad receive <strong className="text-emerald-400">₦{winnerPayout.toLocaleString()} each</strong> (₦{netPool.toLocaleString()} Total Squad Prize Pool)
            </p>
          ) : (
            <p className="text-xs text-neutral-300 font-sans">
              Winner receives <strong className="text-emerald-400">₦{winnerPayout.toLocaleString()}</strong> credited instantly to wallet balance upon victory confirmation.
            </p>
          )}
        </div>

        {/* COMPLETE ECONOMICS BREAKDOWN */}
        <div className="p-4 rounded-2xl bg-black/60 border border-neutral-800 space-y-2.5 text-xs font-mono relative z-10">
          <div className="flex justify-between items-center text-neutral-400">
            <span>{isSquad ? 'Entry Stake / Player:' : 'Player Stake:'}</span>
            <span className="text-white font-bold">₦{stake.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-neutral-400">
            <span>{isSquad ? 'Total Gross Pot (10 Players):' : 'Total Pot (2x Stake):'}</span>
            <span className="text-amber-400 font-bold">₦{grossPot.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-neutral-400 border-t border-neutral-800/80 pt-2">
            <span className="flex items-center gap-1">
              <span>OpsSTAKE Platform Fee ({feePercent}%):</span>
              {isSquad && (
                <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 font-sans font-bold">
                  Reduced Squad Rate vs 1v1
                </span>
              )}
            </span>
            <span className="text-rose-400 font-bold">-₦{platformFee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center text-neutral-200 font-bold border-t border-neutral-800/80 pt-2">
            <span>{isSquad ? 'Winning Squad Net Pool:' : 'Net Winner Payout:'}</span>
            <span className="text-emerald-400 font-black text-sm">₦{netPool.toLocaleString()}</span>
          </div>
          {isSquad && (
            <div className="flex justify-between items-center text-emerald-300 font-bold bg-emerald-950/40 p-2 rounded-xl border border-emerald-500/30">
              <span className="flex items-center gap-1">
                <Award size={14} className="text-amber-400" />
                <span>Each Winning Teammate Receives:</span>
              </span>
              <span className="text-sm font-black text-emerald-400">₦{winnerPayout.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Squad Slots or Match Details */}
        {isSquad && (
          <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between text-xs relative z-10">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-neutral-300">
                Your Slot: <strong className="text-white">Team Alpha (Slot #1 - Host)</strong>
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              {openSlots}/10 Slots Open
            </span>
          </div>
        )}

        {/* Share & Invite Buttons */}
        <div className="space-y-2.5 pt-1 relative z-10">
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="flex-1 py-3 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase flex items-center justify-center gap-2 border border-neutral-700 cursor-pointer transition-all active:scale-95"
            >
              {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} className="text-amber-400" />}
              <span>{copiedLink ? 'Invite Link Copied!' : 'Copy Squad Invite Link'}</span>
            </button>
            <button
              onClick={handleCopyCode}
              className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-mono font-bold uppercase flex items-center justify-center gap-1.5 border border-neutral-700 cursor-pointer transition-all active:scale-95"
              title="Copy Lobby Code"
            >
              {copiedCode ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span>#{match.challengeCode}</span>
            </button>
          </div>

          <button
            onClick={() => {
              onOpenMatchRoom(match.id);
              onClose();
            }}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-neutral-950 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition-all active:scale-95"
          >
            <span>Enter {isSquad ? 'Squad Lobby Room' : 'Match Room'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
