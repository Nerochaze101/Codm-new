import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { X, Building2, Zap, AlertCircle, CheckCircle2, ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react';

interface CashOutModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onConfirmCashOut: (
    amount: number,
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      gateway?: 'flutterwave' | 'paystack';
    }
  ) => Promise<void>;
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
  const [gateway, setGateway] = useState<'flutterwave' | 'paystack'>('flutterwave');
  const [isConfirmStep, setIsConfirmStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setIsSubmitting(false);
      setIsConfirmStep(false);
      setAmountInput(currentUser.balance > 0 ? currentUser.balance.toString() : '1000');
      setBankName(currentUser.bankName || 'OPay Digital Bank');
      setAccountNumber(currentUser.accountNumber || '');
      setAccountName(currentUser.accountName || currentUser.codmIgn || '');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const parsedAmount = parseInt(amountInput, 10);
  const amountToWithdraw = isNaN(parsedAmount) ? 0 : parsedAmount;

  // Step 1: Validate and move to confirmation screen
  const handleProceedToReview = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

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

    setIsConfirmStep(true);
  };

  // Step 2: User explicitly confirms the withdrawal
  const handleFinalSubmit = async () => {
    setError(null);
    setSuccessMsg(null);
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
        gateway,
      });

      setSuccessMsg(`Successfully initiated cash out of ₦${amountToWithdraw.toLocaleString()} via ${gateway === 'flutterwave' ? 'Flutterwave' : 'Paystack'} to ${bankName} (${accountNumber.trim()})!`);
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
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isConfirmStep ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400' : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'}`}>
              {isConfirmStep ? <AlertTriangle className="w-5 h-5" /> : <Zap className="w-5 h-5 fill-current" />}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-heading text-white">
                {isConfirmStep ? 'Confirm Bank Payout' : 'Cash Out Winnings to Bank'}
              </h2>
              <p className="text-xs text-neutral-400">
                {isConfirmStep ? 'Step 2 of 2 · Review Details Before Sending' : 'Step 1 of 2 · Select Amount & Bank Details'}
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
        <div className="p-5 overflow-y-auto space-y-4">
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

          {isConfirmStep ? (
            /* ============================================================ */
            /* STEP 2: EXPLICIT CONFIRMATION SCREEN                         */
            /* ============================================================ */
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              {/* Security Warning Notice */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-300 mb-0.5">Please confirm before sending funds</div>
                  <div className="text-[11px] text-amber-300/80 leading-relaxed">
                    Automated bank disbursements are processed immediately and cannot be cancelled or reversed once confirmed.
                  </div>
                </div>
              </div>

              {/* Review Summary Breakdown */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
                  <span className="text-xs text-neutral-400 uppercase font-mono">Amount to Withdraw</span>
                  <span className="text-xl font-black text-emerald-400 font-mono-nums">
                    ₦{amountToWithdraw.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Destination Bank</span>
                  <span className="font-bold text-white text-right">{bankName}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Account Number</span>
                  <span className="font-bold text-white font-mono text-right tracking-wider">{accountNumber.trim()}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Account Name</span>
                  <span className="font-bold text-white text-right">{accountName.trim()}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Payout Gateway</span>
                  <span className="font-bold text-amber-400 uppercase font-mono text-xs">
                    {gateway === 'flutterwave' ? 'Flutterwave Automated API' : 'Paystack Transfers API'}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Remaining Balance</span>
                  <span className="font-bold text-neutral-300 font-mono-nums">
                    ₦{Math.max(0, currentUser.balance - amountToWithdraw).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Dual Action Confirmation Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer disabled:opacity-50 uppercase flex items-center justify-center gap-2 tracking-wide"
                >
                  {isSubmitting ? (
                    <span>Processing Payout...</span>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Yes, Authorize & Send ₦{amountToWithdraw.toLocaleString()}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsConfirmStep(false)}
                  disabled={isSubmitting}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Edit Details / Go Back</span>
                </button>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* STEP 1: AMOUNT & BANK SELECTION FORM                         */
            /* ============================================================ */
            <form onSubmit={handleProceedToReview} className="space-y-4">
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

              {/* Transfer Gateway Option */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
                  Payout Gateway
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGateway('flutterwave')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      gateway === 'flutterwave'
                        ? 'bg-amber-500/15 border-amber-400 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-amber-400">Flutterwave</div>
                      <div className="text-[10px] text-neutral-400">Direct NUBAN / OPay / PalmPay</div>
                    </div>
                    {gateway === 'flutterwave' && (
                      <div className="w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setGateway('paystack')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      gateway === 'paystack'
                        ? 'bg-emerald-500/15 border-emerald-400 text-white'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-emerald-400">Paystack</div>
                      <div className="text-[10px] text-neutral-400">Transfers API</div>
                    </div>
                    {gateway === 'paystack' && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    )}
                  </button>
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
                <span>Bank details are saved to your profile for instant payouts.</span>
              </div>

              {/* Next Step Review Button */}
              <button
                type="submit"
                disabled={currentUser.balance <= 0}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-xl cursor-pointer disabled:opacity-50 uppercase flex items-center justify-center gap-2 tracking-wide"
              >
                <span>Continue to Withdrawal Confirmation</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
