import React from 'react';
import { ShieldCheck, AlertTriangle, Scale, Lock, X, CheckCircle2, Clock } from 'lucide-react';

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export const TermsModal: React.FC<TermsModalProps> = ({ isOpen, onClose, onAccept }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-neutral-900 border-2 border-amber-500/40 rounded-[2rem] shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-heading font-black text-white uppercase tracking-tight">
                Terms of Service & Arena Protocols
              </h2>
              <p className="text-[11px] text-neutral-400">Read and agree before creating your gladiator account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-neutral-300 leading-relaxed font-sans">
          {/* Section 1: Crucial Abandoned Match Rule */}
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40 space-y-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wide text-xs">
              <Clock className="w-4 h-4" />
              <span>1. Abandoned & Expired Matches: Strictly No Auto-Settlement</span>
            </div>
            <p className="text-white font-medium">
              If the countdown timer expires, an opponent goes AFK, or a match stalls, the platform <strong>strictly does NOT auto-settle</strong> the bet or award a default win.
            </p>
            <ul className="space-y-1.5 pl-3 list-disc text-neutral-300 text-[11px]">
              <li><strong>No Unilateral Refund:</strong> Users cannot unilaterally claim refunds or force a settlement when time is exceeded.</li>
              <li><strong>No Unilateral Timer Restart:</strong> Neither player can reset the timer on their own.</li>
              <li><strong>Mutual Agreement Required:</strong> Both players must agree in the arena to either restart the countdown timer or mutually void the match for a full 100% refund.</li>
              <li><strong>Moderator Escalation:</strong> If mutual consent cannot be reached or an opponent is unresponsive, stakes remain safely held in escrow and players must submit screen recordings to the Moderator Review Queue for staff investigation.</li>
            </ul>
          </div>

          {/* Section 2: Escrow Staking */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide text-xs">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>2. Automated On-Demand Escrow</span>
            </div>
            <p className="text-neutral-400">
              All match stakes are secured in escrow before private lobby room codes are released. Payouts are instantly credited to the verified winner once scoreboard results are confirmed or verified by referee forensic review.
            </p>
          </div>

          {/* Section 3: Verification & Fair Play */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide text-xs">
              <Scale className="w-4 h-4 text-cyan-400" />
              <span>3. Result Verification & Evidence Requirements</span>
            </div>
            <p className="text-neutral-400">
              Players must submit clear, uncropped end-game scoreboards. For high-stakes or contested matches, full screen recordings showing game history and battle results are mandatory. Cheating, emulators (outside agreed rules), or fraudulent scoreboards result in permanent account bans.
            </p>
          </div>

          {/* Section 4: Single Identity & Permanent NUBAN */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wide text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>4. Anti-Smurf & Permanent Banking Policy</span>
            </div>
            <p className="text-neutral-400">
              To prevent multi-accounting and smurfing, each gladiator is restricted to one verified profile. Bank accounts (NUBAN) are permanently tied to your profile upon withdrawal registration.
            </p>
          </div>

          {/* Section 5: Conflict Fraud & Repeat Offense Penalty Policy */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-wide text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>5. Conflict Fraud, Fund Forfeiture & Channel Ban Policy</span>
            </div>
            <p className="text-neutral-300 text-[11px]">
              Submitting false result claims or causing match conflicts triggers our 2-Strike Penalty System:
            </p>
            <ul className="space-y-1 pl-3 list-disc text-neutral-300 text-[11px]">
              <li><strong>Strike 1 (First Violation):</strong> Account flagged, placed on probation, and official warning sent to user's Telegram.</li>
              <li><strong>Strike 2 (Repeat Violation):</strong> Immediate <strong>PERMANENT ACCOUNT BAN</strong>, 100% forfeiture of all wallet balances and escrow funds to ₦0, and permanent ban from the platform, Telegram Bot, and official <strong>@OpsSTAKE</strong> channel.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-neutral-800 bg-neutral-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-neutral-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>By proceeding, you acknowledge and agree to abide by all Arena Protocols.</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors cursor-pointer w-full sm:w-auto text-center"
            >
              Close
            </button>
            {onAccept && (
              <button
                onClick={() => {
                  onAccept();
                  onClose();
                }}
                className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black uppercase tracking-wide transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer w-full sm:w-auto text-center whitespace-nowrap"
              >
                I Agree & Accept Terms
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
