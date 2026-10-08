import React, { useState } from 'react';
import { Match, UserProfile } from '../types';
import { X, Swords, ShieldCheck, Wallet, CheckCircle, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

interface OpponentOnboardingModalProps {
  match: Match | null;
  isOpen: boolean;
  onClose: () => void;
  onCompleteOnboarding: (userData: {
    codmIgn: string;
    codmUid?: string;
    email: string;
    phone: string;
    initialDeposit?: number;
  }) => Promise<void>;
}

export const OpponentOnboardingModal: React.FC<OpponentOnboardingModalProps> = ({
  match,
  isOpen,
  onClose,
  onCompleteOnboarding,
}) => {
  const [codmIgn, setCodmIgn] = useState('');
  const [codmUid, setCodmUid] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+234 8');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !match) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!codmIgn.trim()) {
      setError('Please enter your Call of Duty: Mobile In-Game Name (IGN)');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onCompleteOnboarding({
        codmIgn: codmIgn.trim(),
        codmUid: codmUid.trim() || undefined,
        email: email.trim() || `${codmIgn.trim().toLowerCase().replace(/\s+/g, '_')}@gamer.ng`,
        phone: phone.trim(),
        initialDeposit: 0,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-heading text-white">Accept 1v1 Challenge</h2>
              <p className="text-[11px] text-neutral-400">Review & stake on #{match.challengeCode}</p>
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
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-3">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Challenger card */}
          <div className="p-4 rounded-xl bg-neutral-950 border border-amber-500/30 space-y-2">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider flex items-center justify-between">
              <span>Challenger</span>
              <span className="text-amber-400 font-mono-nums font-bold">Challenge: #{match.challengeCode}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={match.creator.avatar}
                  alt={match.creator.codmIgn}
                  className="w-10 h-10 rounded-lg object-cover bg-neutral-800"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <div className="text-sm font-bold text-white">{match.creator.codmIgn}</div>
                  <div className="text-xs text-neutral-400">{match.gameMode} · {match.map}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-neutral-400 font-mono-nums">POT PRIZE</div>
                <div className="text-base font-black text-amber-400 font-mono-nums">₦{match.potAmount.toLocaleString()}</div>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-400 flex items-center justify-between">
              <span>Match Stake: <strong className="text-emerald-400 font-mono-nums">₦{match.stakeAmount.toLocaleString()}</strong></span>
              <span>Winner Payout: <strong className="text-amber-400 font-mono-nums">₦{match.winnerPayout.toLocaleString()}</strong></span>
            </div>
          </div>

          {/* Form: CODM Gamer Credentials */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Gamer Profile Registration
            </h3>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                Your CODM In-Game Name (IGN) <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. DeltaSniper_NG"
                value={codmIgn}
                onChange={(e) => setCodmIgn(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-amber-400 focus:outline-none"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Must match your exact in-game name so victory screenshots can be verified.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1">
                CODM Player ID (UID)
              </label>
              <input
                type="text"
                placeholder="e.g. 6829471928371902"
                value={codmUid}
                onChange={(e) => setCodmUid(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono-nums text-sm focus:border-amber-400 focus:outline-none"
              />
              <p className="text-[11px] text-neutral-400 mt-1">
                Found in your CODM profile tab.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="gamer@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-neutral-300 block mb-1">
                  WhatsApp / Phone
                </label>
                <input
                  type="tel"
                  placeholder="+234 812 345 6789"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold rounded-xl text-sm transition-all cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Registering Profile...</span>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  <span>Sign Up & Enter Match Room</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
