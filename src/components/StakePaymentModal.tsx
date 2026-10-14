import React, { useState, useEffect } from 'react';
import { Match, UserProfile } from '../types';
import {
  X, ShieldCheck, Swords, Sparkles, AlertCircle, Clock, Lock, Zap
} from 'lucide-react';
import { CheckoutModal } from './CheckoutModal';

interface StakePaymentModalProps {
  isOpen: boolean;
  match: Match | null;
  currentUser: UserProfile;
  role: 'opponent' | 'creator';
  onClose: () => void;
  onConfirmStake: (paymentMethod: 'wallet_balance' | 'flutterwave') => Promise<void>;
}

export const StakePaymentModal: React.FC<StakePaymentModalProps> = ({
  isOpen,
  match,
  currentUser,
  role,
  onClose,
  onConfirmStake,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'wallet_balance' | 'flutterwave'>('flutterwave');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(600); // 10 minutes escrow window

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsProcessing(false);
      setIsCheckoutOpen(false);
      setCountdown(600);
      if (currentUser.balance >= (match?.stakeAmount || 0)) {
        setSelectedMethod('wallet_balance');
      } else {
        setSelectedMethod('flutterwave');
      }
    }
  }, [isOpen, match, currentUser]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  if (!isOpen || !match) return null;

  const stakeAmount = match.stakeAmount;
  const isOpponent = role === 'opponent';
  const hasBalance = currentUser.balance >= stakeAmount;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePay = async () => {
    setError(null);

    if (selectedMethod === 'flutterwave') {
      setIsCheckoutOpen(true);
      return;
    }

    setIsProcessing(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await onConfirmStake(selectedMethod);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm stake payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckoutSuccess = async (ref: string) => {
    setIsCheckoutOpen(false);
    setIsProcessing(true);
    try {
      await onConfirmStake('flutterwave');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm escrow payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold font-heading text-white flex items-center gap-2">
                  <span>{isOpponent ? 'Accept Challenge & Send Stake' : 'Send Matching Stake to Unlock Room'}</span>
                </h2>
                <p className="text-xs text-neutral-400">
                  {isOpponent
                    ? `Send ₦${stakeAmount.toLocaleString()} to lock in escrow & accept duel`
                    : `Opponent has paid! Send your ₦${stakeAmount.toLocaleString()} to generate in-game room #`}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-5 overflow-y-auto space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Match Summary Pill */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-amber-500/30 flex items-center justify-between">
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                  Challenge #{match.challengeCode}
                </div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Swords className="w-4 h-4 text-amber-400" />
                  <span>{match.gameMode} ({match.map})</span>
                </div>
                <div className="text-xs text-neutral-400">
                  Rival: <strong className="text-white">{isOpponent ? match.creator.codmIgn : match.opponent?.codmIgn || 'Opponent'}</strong>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-mono uppercase text-neutral-400">YOUR STAKE</div>
                <div className="text-xl font-black text-amber-400 font-mono-nums">
                  ₦{stakeAmount.toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-400 font-mono-nums font-semibold">
                  Win Payout: ₦{match.winnerPayout.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Escrow Process Flow Indicator */}
            <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 text-xs space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase">
                <span>Escrow Flow</span>
                <span className="text-amber-400 font-mono flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Hold Time: {formatTime(countdown)}</span>
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-[10px] text-center">
                <div className={`p-2 rounded-lg border ${
                  isOpponent ? 'bg-amber-500/10 border-amber-400 text-amber-300 font-bold' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                }`}>
                  1. Opponent Stakes {isOpponent ? '(You)' : '✓ Done'}
                </div>
                <div className={`p-2 rounded-lg border ${
                  !isOpponent ? 'bg-amber-500/10 border-amber-400 text-amber-300 font-bold animate-pulse' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                }`}>
                  2. Host Stakes {!isOpponent ? '(You)' : ''}
                </div>
                <div className="p-2 rounded-lg border bg-neutral-900 border-neutral-800 text-neutral-400">
                  3. Room # Generated
                </div>
              </div>
            </div>

            {/* Select Escrow Payment Method */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                Select Escrow Payment Method
              </label>

              <div className="grid grid-cols-1 gap-2.5">
                {/* Checkout Link Gateway */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('flutterwave')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    selectedMethod === 'flutterwave'
                      ? 'bg-amber-500/10 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                    <Zap className="w-4 h-4 fill-current" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-amber-400 uppercase">Secure Checkout Link (OPay / Transfer / Card)</div>
                    <div className="text-[11px] text-neutral-300">Pay instantly via OPay, Transfer, USSD, or Card checkout popup</div>
                  </div>
                </button>

                {/* Existing Balance */}
                {hasBalance && (
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('wallet_balance')}
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                      selectedMethod === 'wallet_balance'
                        ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-md ring-1 ring-cyan-400'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-cyan-300 uppercase">Existing Wallet Balance</div>
                      <div className="text-[11px] text-neutral-300 font-mono-nums">₦{currentUser.balance.toLocaleString()} available to lock instantly</div>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* Escrow Guarantee Notice */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>100% Escrow Protection:</strong> Funds are locked securely in escrow and only paid to the confirmed winner after AI screenshot verification. If a match is cancelled or ends in a draw, your ₦{stakeAmount.toLocaleString()} is refunded 100%.
              </span>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePay}
              disabled={isProcessing}
              className="flex-1 py-3 px-5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs sm:text-sm shadow-xl transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide"
            >
              {isProcessing ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                  <span>Confirming Escrow Payment...</span>
                </span>
              ) : (
                <>
                  <Lock className="w-4 h-4 stroke-[2.5]" />
                  <span>
                    {isOpponent
                      ? `Proceed to Checkout (₦${stakeAmount.toLocaleString()})`
                      : `Send ₦${stakeAmount.toLocaleString()} & Generate Room #`}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Checkout Gateway Link Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        amount={stakeAmount}
        title={`CODM Escrow: ${match.challengeCode}`}
        description={`Secure Stake Payment for 1v1 ${match.gameMode}`}
        customer={{
          name: currentUser.accountName || currentUser.codmIgn,
          email: currentUser.email || `${currentUser.codmIgn.toLowerCase()}@player.ng`,
          phone: currentUser.phone || '08000000000',
        }}
        reference={`CHECKOUT_STAKE_${match.challengeCode}_${Date.now()}`}
        onSuccess={handleCheckoutSuccess}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </>
  );
};
