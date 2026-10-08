import React, { useState } from 'react';
import { Match } from '../types';
import { X, Copy, Check, Share2, MessageCircle, Swords, UserPlus, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';

interface InviteOpponentModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
  onSimulateOpponentJoin: (matchId: string) => void;
  onSimulateNewUserJoin: (matchId: string) => void;
  onCancelMatch: (matchId: string) => void;
}

export const InviteOpponentModal: React.FC<InviteOpponentModalProps> = ({
  match,
  isOpen,
  onClose,
  onSimulateOpponentJoin,
  onSimulateNewUserJoin,
  onCancelMatch,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen || !match) return null;

  const inviteUrl = `${window.location.origin}/?join=${match.id}`;
  const whatsappShareText = encodeURIComponent(
    `⚔️ CODM 1v1 CHALLENGE!\nI set a ₦${match.stakeAmount.toLocaleString()} stake on a ${match.gameMode} (${match.map}) match.\nChallenge Code: ${match.challengeCode}\nTotal Pot: ₦${match.potAmount.toLocaleString()}.\nAccept challenge & send your stake to unlock our game room:\n${inviteUrl}`
  );

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(match.challengeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-white">Share 1v1 Challenge Link</h2>
              <p className="text-xs text-neutral-400">Challenge created · ₦0 upfront · ₦{match.stakeAmount.toLocaleString()} stake</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Challenge Code Card */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-amber-500/30 text-center space-y-1 relative overflow-hidden">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-widest">
              Challenge Invite Code
            </div>
            <div className="text-2xl sm:text-3xl font-black font-mono-nums tracking-wider text-amber-400">
              {match.challengeCode}
            </div>
            <p className="text-[11px] text-neutral-400">
              Share this code or link with your rival to accept your wager
            </p>
            <button
              onClick={copyCode}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCode ? 'Challenge Code Copied!' : 'Copy Challenge Code'}</span>
            </button>
          </div>

          {/* Direct Invite Link */}
          <div>
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              Copy Invite Link for Opponent
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full px-3 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-neutral-300 font-mono-nums text-xs truncate focus:outline-none"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs rounded-xl transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5"
              >
                {copiedLink ? <Check className="w-4 h-4 text-neutral-950" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>
            <div className="mt-2 p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
              <div className="font-semibold text-amber-300">Next Steps:</div>
              <div>1. Opponent opens link and sends ₦{match.stakeAmount.toLocaleString()} to accept challenge.</div>
              <div>2. You will send your matching ₦{match.stakeAmount.toLocaleString()} stake.</div>
              <div>3. The system will immediately generate your in-game CODM room number!</div>
            </div>
          </div>

          {/* Social share actions */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/?text=${whatsappShareText}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-600/20 border border-emerald-500/40 hover:bg-emerald-600/30 text-emerald-400 text-xs font-bold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share to WhatsApp</span>
            </a>

            <button
              onClick={copyLink}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>Share Link</span>
            </button>
          </div>

          {/* Simulation & Testing Panel for 1-device review */}
          <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-neutral-300 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Quick Test In Same Browser</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono-nums">TEST HELPERS</span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-normal">
              You can test the opponent acceptance flow right here, or open the invite link in an incognito window:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                onClick={() => {
                  onSimulateOpponentJoin(match.id);
                  onClose();
                }}
                className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <span>Join as ShadowSniper</span>
              </button>

              <button
                onClick={() => {
                  onSimulateNewUserJoin(match.id);
                  onClose();
                }}
                className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-amber-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-amber-500/20"
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Test New User Sign-Up</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with match cancellation */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to cancel this match challenge?')) {
                onCancelMatch(match.id);
                onClose();
              }
            }}
            className="text-xs text-rose-400 hover:underline cursor-pointer flex items-center gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Cancel Match Challenge</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
