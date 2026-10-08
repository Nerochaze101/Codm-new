import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { X, Building2, Zap, AlertCircle, CheckCircle2, ShieldCheck, Lock } from 'lucide-react';

interface CashOutModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onConfirmCashOut: (amount: number, bankDetails: { bankName: string; accountNumber: string; accountName: string }) => Promise<void>;
  onSaveBankInfo?: (bankDetails: { bankName: string; accountNumber: string; accountName: string }) => Promise<void>;
}

const NIGERIAN_BANKS = [
  'OPay Digital Bank',
  'PalmPay',
  'GTBank (Guaranty Trust Bank)',
  'Kuda Bank',
  'Moniepoint Microfinance Bank',
  'Zenith Bank',
  'Access Bank',
  'First Bank of Nigeria',
  'UBA (United Bank for Africa)',
  'Wema Bank',
  'Stanbic IBTC Bank',
  'Fidelity Bank',
  'Sterling Bank',
  'FCMB (First City Monument Bank)',
  'Union Bank',
  'Providus Bank',
];

export const CashOutModal: React.FC<CashOutModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onConfirmCashOut,
  onSaveBankInfo,
}) => {
  const [amountInput, setAmountInput] = useState<string>('');
  const [bankName, setBankName] = useState<string>('OPay Digital Bank');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setIsSubmitting(false);
      setAmountInput(currentUser.balance > 0 ? currentUser.balance.toString() : '1000');
      setBankName(currentUser.bankName || 'OPay Digital Bank');
      setAccountNumber(currentUser.accountNumber || '');
      setAccountName(currentUser.accountName || currentUser.codmIgn || '');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const parsedAmount = parseInt(amountInput, 10);
  const amountToWithdraw = isNaN(parsedAmount) ? 0 : parsedAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (isNaN(amountToWithdraw) || amountToWithdraw < 100) {
      setError('Minimum cash out amount is ₦100');
      return;
    }

    if (amountToWithdraw > currentUser.balance) {
      setError(`Insufficient balance. Maximum available is ₦${currentUser.balance.toLocaleString()}`);
      return;
    }

    if (!bankName) {
      setError('Please select your bank name');
      return;
    }

    if (!accountNumber || accountNumber.trim().length < 10) {
      setError('Please enter a valid 10-digit Nigerian bank account number');
      return;
    }

    if (!accountName || !accountName.trim()) {
      setError('Please enter the account name matching your bank record');
      return;
    }

    setIsSubmitting(true);
    try {
      // Save bank details to user profile first
      if (onSaveBankInfo) {
        await onSaveBankInfo({
          bankName,
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        });
      }

      // Execute cashout
      await onConfirmCashOut(amountToWithdraw, {
        bankName,
        accountNumber: accountNumber.trim(),
        accountName: accountName.trim(),
      });

      setSuccessMsg(`Successfully initiated cash out of ₦${amountToWithdraw.toLocaleString()} to ${bankName} (${accountNumber.trim()})!`);
      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      setError(err.message || 'Cash out failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 bg-neutral-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                Cash Out Winnings to Bank
              </h2>
              <p className="text-xs text-neutral-400">
                Direct Automated Transfer · Instant Payout
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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Balance Pill */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">AVAILABLE BALANCE</div>
              <div className="text-2xl font-black text-white font-mono-nums">
                ₦{currentUser.balance.toLocaleString()}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAmountInput(currentUser.balance.toString())}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/25 text-xs font-bold font-mono transition-all cursor-pointer"
            >
              MAX ₦{currentUser.balance.toLocaleString()}
            </button>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              Withdrawal Amount (₦)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs text-emerald-400 font-black font-mono-nums">₦</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setAmountInput(val);
                  setError(null);
                }}
                placeholder="Enter amount (e.g. 1000, 5000)"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono-nums font-bold text-sm focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>

          {/* Bank Name Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              Select Nigerian Bank
            </label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-semibold text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
            >
              {NIGERIAN_BANKS.map((b) => (
                <option key={b} value={b} className="bg-neutral-900 text-white">
                  {b}
                </option>
              ))}
            </select>
          </div>

          {/* Account Number Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              10-Digit Account Number
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={10}
              value={accountNumber}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setAccountNumber(val);
                setError(null);
              }}
              placeholder="e.g. 8031234567 or 9012345678"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono-nums font-bold text-sm focus:outline-none focus:border-emerald-400"
            />
          </div>

          {/* Account Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
              Account Name (As on Bank Record)
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="e.g. John Doe or CODM Ace"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-semibold text-xs focus:outline-none focus:border-emerald-400"
            />
          </div>

          <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Bank details will be saved to your profile for zero-delay instant cashouts on future match wins.</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || currentUser.balance <= 0}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer disabled:opacity-50 uppercase flex items-center justify-center gap-2 tracking-wide"
          >
            {isSubmitting ? (
              <span>Initiating Bank Payout...</span>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-current" />
                <span>Confirm Cash Out ₦{amountToWithdraw.toLocaleString()}</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
