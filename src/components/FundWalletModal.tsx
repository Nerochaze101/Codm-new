import React, { useState, useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import {
  X,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  Clock,
  ArrowLeft,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { openFlutterwavePopup } from '../utils/flutterwave';
import { openPaystackPopup } from '../utils/paystack';
import { depositWallet } from '../services/api';

interface FundWalletModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccessDeposit: (newBalance: number, amountFunded: number) => void;
}

interface DynamicBankDetails {
  accountNumber: string;
  bankName: string;
  accountName: string;
  amount: number;
  txRef: string;
  expiration?: string;
}

const PRESET_AMOUNTS = [500, 1000, 2500, 5000, 10000, 20000];

export const FundWalletModal: React.FC<FundWalletModalProps> = ({
  isOpen,
  currentUser,
  onClose,
  onSuccessDeposit,
}) => {
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('1000');
  const [method, setMethod] = useState<'bank_transfer' | 'flutterwave_popup' | 'paystack'>('bank_transfer');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkNotice, setCheckNotice] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'account' | 'amount' | null>(null);
  const [bankDetails, setBankDetails] = useState<DynamicBankDetails | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(3600); // 60 mins
  const [successInfo, setSuccessInfo] = useState<{ amount: number; balance: number; txId: string } | null>(null);

  const pollIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      setBankDetails(null);
      setSuccessInfo(null);
      setErrorMessage(null);
      setCheckNotice(null);
      setIsProcessing(false);
      setIsCheckingPayment(false);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  }, [isOpen]);

  // Countdown timer for active dynamic virtual account
  useEffect(() => {
    let timer: any = null;
    if (bankDetails) {
      setSecondsRemaining(3600);
      timer = setInterval(() => {
        setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [bankDetails]);

  // Auto-polling verifier every 5 seconds while in bank transfer screen
  useEffect(() => {
    if (bankDetails && !successInfo) {
      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch('/api/flutterwave/verify-bank-transfer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              txRef: bankDetails.txRef,
            }),
          });
          const data = await res.json();
          if (data.status === 'success' && data.verified) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setSuccessInfo({
              amount: data.amount || bankDetails.amount,
              balance: data.balance,
              txId: bankDetails.txRef,
            });
            onSuccessDeposit(data.balance, data.amount || bankDetails.amount);
          }
        } catch {
          // silent background poll error
        }
      }, 5000);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [bankDetails, successInfo, currentUser.id, onSuccessDeposit]);

  if (!isOpen) return null;

  const handleSelectPreset = (amt: number) => {
    setSelectedAmount(amt);
    setCustomAmount(amt.toString());
    setErrorMessage(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    setCustomAmount(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed)) {
      setSelectedAmount(parsed);
    } else {
      setSelectedAmount(0);
    }
    setErrorMessage(null);
  };

  const copyToClipboard = (text: string, field: 'account' | 'amount') => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Generate dynamic bank transfer account
  const handleGenerateBankAccount = async () => {
    const amountToFund = parseInt(customAmount, 10);
    if (isNaN(amountToFund) || amountToFund < 100) {
      setErrorMessage('Minimum deposit amount is ₦100');
      return;
    }

    setErrorMessage(null);
    setCheckNotice(null);
    setIsProcessing(true);

    try {
      const res = await fetch('/api/flutterwave/charge-bank-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          amount: amountToFund,
        }),
      });

      const data = await res.json();

      if (data.status === 'success' && data.accountNumber) {
        setBankDetails({
          accountNumber: data.accountNumber,
          bankName: data.bankName,
          accountName: data.accountName,
          amount: data.amount,
          txRef: data.txRef,
          expiration: data.expiration,
        });
      } else {
        setErrorMessage(data.message || 'Could not generate dynamic account. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error generating transfer account.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Manual "I Have Sent the Money" confirmation check
  const handleVerifySentMoney = async () => {
    if (!bankDetails) return;

    setIsCheckingPayment(true);
    setCheckNotice(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/flutterwave/verify-bank-transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          txRef: bankDetails.txRef,
        }),
      });

      const data = await res.json();

      if (data.status === 'success' && data.verified) {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setSuccessInfo({
          amount: data.amount || bankDetails.amount,
          balance: data.balance,
          txId: bankDetails.txRef,
        });
        onSuccessDeposit(data.balance, data.amount || bankDetails.amount);
      } else {
        setCheckNotice(
          data.message ||
            'Transfer is still pending inter-bank clearing. If you just sent it from OPay or your bank app, please wait 30 seconds and click again.'
        );
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error checking transfer status. Please try again.');
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Alternate Popups (Cards / USSD / Paystack)
  const handleProceedPopup = () => {
    const amountToFund = parseInt(customAmount, 10);
    if (isNaN(amountToFund) || amountToFund < 100) {
      setErrorMessage('Minimum deposit amount is ₦100');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    if (method === 'flutterwave_popup') {
      const launched = openFlutterwavePopup({
        email: currentUser.email || `${currentUser.codmIgn.toLowerCase()}@player.ng`,
        name: currentUser.accountName || currentUser.codmIgn,
        phone: currentUser.phone || '08000000000',
        amountNaira: amountToFund,
        reference: `FLW_DEP_${Date.now()}`,
        title: 'Fund CODM Wallet',
        description: `Instant deposit of ₦${amountToFund.toLocaleString()} to player balance`,
        metadata: {
          userId: currentUser.id,
          playerIgn: currentUser.codmIgn,
        },
        onSuccess: async (ref, txId) => {
          try {
            const result = await depositWallet(currentUser.id, amountToFund, 'Flutterwave Instant Deposit', ref, txId);
            setIsProcessing(false);
            setSuccessInfo({
              amount: amountToFund,
              balance: result.balance,
              txId: result.transaction?.id || ref,
            });
            onSuccessDeposit(result.balance, amountToFund);
          } catch (err: any) {
            setIsProcessing(false);
            setErrorMessage(err.message || 'Deposit verification failed. Please check transactions.');
          }
        },
        onClose: () => {
          setIsProcessing(false);
        },
        onError: (err) => {
          setIsProcessing(false);
          setErrorMessage(err.message || 'Flutterwave checkout encountered an issue.');
        },
      });

      if (!launched) {
        setIsProcessing(false);
        setErrorMessage('Could not load Flutterwave SDK. Please refresh and try again.');
      }
    } else if (method === 'paystack') {
      const launched = openPaystackPopup({
        email: currentUser.email || `${currentUser.codmIgn.toLowerCase()}@player.ng`,
        amountNaira: amountToFund,
        reference: `DEP_${Date.now()}`,
        metadata: {
          userId: currentUser.id,
          playerIgn: currentUser.codmIgn,
        },
        onSuccess: async (ref) => {
          try {
            const result = await depositWallet(currentUser.id, amountToFund, 'Paystack Instant Deposit', ref, ref);
            setIsProcessing(false);
            setSuccessInfo({
              amount: amountToFund,
              balance: result.balance,
              txId: result.transaction?.id || ref,
            });
            onSuccessDeposit(result.balance, amountToFund);
          } catch (err: any) {
            setIsProcessing(false);
            setErrorMessage(err.message || 'Deposit verification failed.');
          }
        },
        onClose: () => {
          setIsProcessing(false);
        },
        onError: (err) => {
          setIsProcessing(false);
          setErrorMessage(err.message || 'Paystack checkout encountered an issue.');
        },
      });

      if (!launched) {
        setIsProcessing(false);
        setErrorMessage('Could not load Paystack SDK. Please refresh and try again.');
      }
    }
  };

  const handleClose = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setBankDetails(null);
    setSuccessInfo(null);
    setErrorMessage(null);
    setCheckNotice(null);
    setIsProcessing(false);
    onClose();
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-base font-black text-white font-heading uppercase tracking-wide">
                {bankDetails ? 'Transfer to Bank Account' : 'Fund Esports Wallet'}
              </h2>
              <p className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>{bankDetails ? 'Dedicated Session NUBAN' : 'Instant Nigerian Naira (₦) Escrow Credit'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {successInfo ? (
            /* ======================================================== */
            /* SUCCESS STATE                                            */
            /* ======================================================== */
            <div className="text-center py-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white uppercase font-heading">
                  Deposit Confirmed!
                </h3>
                <p className="text-sm text-neutral-400">
                  Your payment has cleared and your balance is credited immediately.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2 text-left">
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-neutral-400">Amount Funded:</span>
                  <span className="text-amber-400 font-bold text-sm">+₦{successInfo.amount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-neutral-400">New Available Balance:</span>
                  <span className="text-emerald-400 font-bold text-sm">₦{successInfo.balance.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-neutral-500 border-t border-neutral-900 pt-2">
                  <span>Reference ID:</span>
                  <span className="truncate max-w-[200px]">{successInfo.txId}</span>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-sm uppercase tracking-wide cursor-pointer transition-all shadow-lg"
              >
                Done / Return to App
              </button>
            </div>
          ) : bankDetails ? (
            /* ======================================================== */
            /* ACTIVE DYNAMIC BANK TRANSFER SCREEN                     */
            /* ======================================================== */
            <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
              {/* Top Banner Notice */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                  <span>Account expires in:</span>
                </div>
                <span className="font-mono font-black text-amber-400 text-sm tracking-wider">
                  {formatTimer(secondsRemaining)}
                </span>
              </div>

              {/* Bank Transfer Details Box */}
              <div className="p-5 rounded-2xl bg-neutral-950 border-2 border-amber-400/50 space-y-4 shadow-xl">
                <div className="text-center pb-3 border-b border-neutral-800/80">
                  <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest block mb-1">
                    EXACT AMOUNT TO TRANSFER
                  </span>
                  <div className="text-3xl font-black text-emerald-400 font-mono-nums flex items-center justify-center gap-2">
                    <span>₦{bankDetails.amount.toLocaleString()}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankDetails.amount.toString(), 'amount')}
                      className="p-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                      title="Copy amount"
                    >
                      {copiedField === 'amount' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Account Number with Prominent Copy Button */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono uppercase text-neutral-400 block">
                    Account Number
                  </span>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-700">
                    <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-widest">
                      {bankDetails.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(bankDetails.accountNumber, 'account')}
                      className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow"
                    >
                      {copiedField === 'account' ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Bank Name */}
                <div className="flex items-center justify-between text-xs py-1">
                  <span className="text-neutral-400 font-mono">Bank Name</span>
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    {bankDetails.bankName}
                  </span>
                </div>

                {/* Beneficiary Name */}
                <div className="flex items-center justify-between text-xs py-1 border-t border-neutral-900 pt-2">
                  <span className="text-neutral-400 font-mono">Beneficiary Name</span>
                  <span className="font-bold text-white text-right">
                    {bankDetails.accountName}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                <div className="font-bold text-neutral-300">How to complete:</div>
                <div className="leading-relaxed">
                  1. Open your <strong>OPay, PalmPay, Kuda, or bank app</strong>.<br />
                  2. Transfer exactly <strong>₦{bankDetails.amount.toLocaleString()}</strong> to the account above.<br />
                  3. Tap <strong>"I Have Sent the Money"</strong> below once sent.
                </div>
              </div>

              {/* Status Notice / Checking Status */}
              {checkNotice && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
                  <RefreshCw className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-spin" />
                  <span>{checkNotice}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={handleVerifySentMoney}
                  disabled={isCheckingPayment}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-sm uppercase tracking-wider cursor-pointer transition-all shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isCheckingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Checking with Bank...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>I Have Sent the Money</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setBankDetails(null)}
                  disabled={isCheckingPayment}
                  className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Cancel / Change Amount</span>
                </button>
              </div>

              <div className="text-center">
                <span className="text-[10px] text-neutral-500 font-mono flex items-center justify-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400/80" />
                  Auto-checking every 5 seconds · Funds credit instantly on receipt
                </span>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* STEP 1: AMOUNT & METHOD SELECTOR                         */
            /* ======================================================== */
            <>
              {/* Current Balance HUD */}
              <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase text-neutral-400">Current Wallet Balance</div>
                  <div className="text-2xl font-black text-white font-mono-nums">
                    ₦{currentUser.balance.toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold">
                    ESCROW READY
                  </span>
                </div>
              </div>

              {/* Amount Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Select Deposit Amount
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPreset(amt)}
                      className={`py-2.5 px-3 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer ${
                        selectedAmount === amt && customAmount === amt.toString()
                          ? 'bg-amber-400 text-neutral-950 border-amber-400 shadow-md font-black scale-[1.02]'
                          : 'bg-neutral-950/60 text-neutral-300 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Custom Amount Field */}
                <div className="relative mt-2">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 font-bold font-mono">
                    ₦
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={customAmount}
                    onChange={handleCustomChange}
                    placeholder="Enter custom amount"
                    className="w-full pl-8 pr-4 py-3 bg-neutral-950 border border-neutral-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-white font-mono text-sm outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-neutral-500 font-mono">
                  Minimum deposit: ₦100. Funds are available instantly for wagering.
                </p>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Choose Payment Method
                </label>
                <div className="space-y-2">
                  {/* Dynamic Bank Transfer (RECOMMENDED) */}
                  <button
                    type="button"
                    onClick={() => setMethod('bank_transfer')}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative flex items-start justify-between ${
                      method === 'bank_transfer'
                        ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          Bank Transfer (OPay / Kuda / Any Bank)
                        </span>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                          FASTEST & RECOMMENDED
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-300 font-sans leading-tight">
                        Generates a dedicated account number. Send from any bank app & tap "I Have Sent the Money".
                      </p>
                    </div>
                    {method === 'bank_transfer' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-1" />
                    )}
                  </button>

                  {/* Flutterwave Popup (Cards / USSD) */}
                  <button
                    type="button"
                    onClick={() => setMethod('flutterwave_popup')}
                    className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between ${
                      method === 'flutterwave_popup'
                        ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-neutral-200 mb-0.5 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-neutral-400" />
                        Debit Card / USSD Popup
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-tight">
                        Visa, Mastercard, Verve & USSD codes via Flutterwave Checkout popup.
                      </p>
                    </div>
                    {method === 'flutterwave_popup' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-1" />
                    )}
                  </button>

                  {/* Paystack Fallback */}
                  <button
                    type="button"
                    onClick={() => setMethod('paystack')}
                    className={`w-full p-3 rounded-2xl border text-left transition-all cursor-pointer flex items-start justify-between ${
                      method === 'paystack'
                        ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-bold text-neutral-200 mb-0.5 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        Paystack Gateway
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-tight">
                        Alternate gateway supporting cards, Apple Pay & transfers.
                      </p>
                    </div>
                    {method === 'paystack' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0 mt-1" />
                    )}
                  </button>
                </div>
              </div>

              {/* Error Box */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Button */}
              <button
                type="button"
                onClick={method === 'bank_transfer' ? handleGenerateBankAccount : handleProceedPopup}
                disabled={isProcessing || !selectedAmount || selectedAmount < 100}
                className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-sm uppercase tracking-wider cursor-pointer transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {method === 'bank_transfer' ? 'Generating Dedicated Account...' : 'Launching Checkout...'}
                    </span>
                  </>
                ) : (
                  <>
                    <span>
                      {method === 'bank_transfer'
                        ? `Generate Bank Account (₦${selectedAmount.toLocaleString()})`
                        : `Proceed to Pay ₦${selectedAmount.toLocaleString()}`}
                    </span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>

              <div className="text-center">
                <span className="text-[10px] text-neutral-500 font-mono">
                  🔒 Secured 256-Bit SSL Escrow Gateway • Instant Automated Reconciliation
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
