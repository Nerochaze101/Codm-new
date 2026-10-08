import React, { useState, useEffect } from 'react';
import { Match, UserProfile } from '../types';
import {
  X, ShieldCheck, Swords, Copy, Check, ArrowRight, Building2,
  Smartphone, CreditCard, Sparkles, AlertCircle, Clock, CheckCircle2, Lock
} from 'lucide-react';

interface StakePaymentModalProps {
  isOpen: boolean;
  match: Match | null;
  currentUser: UserProfile;
  role: 'opponent' | 'creator';
  onClose: () => void;
  onConfirmStake: (paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance') => Promise<void>;
}

export const StakePaymentModal: React.FC<StakePaymentModalProps> = ({
  isOpen,
  match,
  currentUser,
  role,
  onClose,
  onConfirmStake,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance'>('bank_transfer');
  const [copiedAcc, setCopiedAcc] = useState(false);
  const [copiedRef, setCopiedRef] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'transfer_details' | 'verifying'>('select');
  const [countdown, setCountdown] = useState(600); // 10 minutes escrow window

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsProcessing(false);
      setStep('select');
      setCountdown(600);
      // If user has balance >= stake, default to wallet or bank transfer
      if (currentUser.balance >= (match?.stakeAmount || 0)) {
        setSelectedMethod('wallet_balance');
      } else {
        setSelectedMethod('bank_transfer');
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

  // Virtual escrow account details (deterministic per match/challenge)
  const virtualBank = 'Wema Bank (Monnify Escrow)';
  const virtualAccNumber = `90${match.challengeCode.replace(/[^0-9]/g, '').padEnd(8, '472918').slice(0, 8)}`;
  const virtualAccName = `CODM STAKE - ${match.challengeCode}`;
  const paymentReference = `${match.challengeCode}-${currentUser.codmIgn.slice(0, 4).toUpperCase()}`;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const copyAccount = () => {
    navigator.clipboard.writeText(virtualAccNumber);
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const copyRef = () => {
    navigator.clipboard.writeText(paymentReference);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handlePay = async () => {
    setIsProcessing(true);
    setError(null);
    setStep('verifying');

    try {
      // Simulate real-time escrow verification delay for high fidelity
      await new Promise((resolve) => setTimeout(resolve, 1400));
      await onConfirmStake(selectedMethod);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to confirm stake payment');
      setStep('select');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
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

          {/* Select Direct Payment Method */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              Select Direct Escrow Payment Method
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Option 1: Instant Bank Transfer */}
              <button
                type="button"
                onClick={() => setSelectedMethod('bank_transfer')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  selectedMethod === 'bank_transfer'
                    ? 'bg-amber-500/10 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Instant Bank Transfer</div>
                  <div className="text-[10px] text-neutral-400">OPay, GTB, Zenith, PalmPay, Kuda</div>
                </div>
              </button>

              {/* Option 2: OPay / PalmPay One-Click */}
              <button
                type="button"
                onClick={() => setSelectedMethod('opay_palmpay')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  selectedMethod === 'opay_palmpay'
                    ? 'bg-emerald-500/10 border-emerald-400 text-white shadow-md ring-1 ring-emerald-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">OPay / PalmPay Direct</div>
                  <div className="text-[10px] text-neutral-400">Instant app escrow confirmation</div>
                </div>
              </button>

              {/* Option 3: Debit Card */}
              <button
                type="button"
                onClick={() => setSelectedMethod('card')}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                  selectedMethod === 'card'
                    ? 'bg-amber-500/10 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Debit Card (Paystack)</div>
                  <div className="text-[10px] text-neutral-400">Visa, Mastercard, Verve</div>
                </div>
              </button>

              {/* Option 4: Account Balance (If user has funds) */}
              {hasBalance && (
                <button
                  type="button"
                  onClick={() => setSelectedMethod('wallet_balance')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    selectedMethod === 'wallet_balance'
                      ? 'bg-cyan-500/10 border-cyan-400 text-white shadow-md ring-1 ring-cyan-400'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">Existing Balance</div>
                    <div className="text-[10px] text-cyan-300 font-mono-nums">₦{currentUser.balance.toLocaleString()} available</div>
                  </div>
                </button>
              )}
            </div>
          </div>

          {/* Transfer Details Card when Bank Transfer is selected */}
          {selectedMethod === 'bank_transfer' && (
            <div className="p-4 rounded-2xl bg-neutral-950 border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>Virtual Escrow Account Details</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono">AUTOMATED RECONCILIATION</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                  <span className="text-neutral-400">Bank Name:</span>
                  <span className="font-bold text-white">{virtualBank}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                  <span className="text-neutral-400">Account Number:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono-nums font-black text-amber-400 text-sm tracking-wider">
                      {virtualAccNumber}
                    </span>
                    <button
                      type="button"
                      onClick={copyAccount}
                      className="p-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                      title="Copy account number"
                    >
                      {copiedAcc ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                  <span className="text-neutral-400">Account Name:</span>
                  <span className="font-bold text-white font-mono text-[11px] truncate max-w-[200px]">{virtualAccName}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800">
                  <span className="text-neutral-400">Payment Remark:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400 text-xs">
                      {paymentReference}
                    </span>
                    <button
                      type="button"
                      onClick={copyRef}
                      className="p-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors cursor-pointer"
                      title="Copy reference"
                    >
                      {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-neutral-400 leading-normal">
                Transfer exactly <strong className="text-amber-400 font-mono-nums">₦{stakeAmount.toLocaleString()}</strong> from your banking app. Once sent, click the confirm button below.
              </p>
            </div>
          )}

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
                    ? `I Have Sent ₦${stakeAmount.toLocaleString()} (Lock Stake)`
                    : `Send ₦${stakeAmount.toLocaleString()} & Generate Room #`}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
