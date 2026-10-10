import React, { useState } from 'react';
import { UserProfile } from '../types';
import { X, Zap, ShieldCheck, CheckCircle2, AlertCircle, CreditCard, ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { openFlutterwavePopup } from '../utils/flutterwave';
import { openPaystackPopup } from '../utils/paystack';
import { depositWallet } from '../services/api';

interface FundWalletModalProps {
  isOpen: boolean;
  currentUser: UserProfile;
  onClose: () => void;
  onSuccessDeposit: (newBalance: number, amountFunded: number) => void;
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
  const [gateway, setGateway] = useState<'flutterwave' | 'paystack'>('flutterwave');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ amount: number; balance: number; txId: string } | null>(null);

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

  const handleProceed = () => {
    const amountToFund = parseInt(customAmount, 10);
    if (isNaN(amountToFund) || amountToFund < 100) {
      setErrorMessage('Minimum deposit amount is ₦100');
      return;
    }

    setErrorMessage(null);
    setIsProcessing(true);

    if (gateway === 'flutterwave') {
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
    } else {
      // Paystack Fallback
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
    setSuccessInfo(null);
    setErrorMessage(null);
    setIsProcessing(false);
    onClose();
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
                Fund Esports Wallet
              </h2>
              <p className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Instant Nigerian Naira (₦) Escrow Credit</span>
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
            /* Success State */
            <div className="text-center py-6 space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-black text-white uppercase font-heading">
                  Deposit Confirmed!
                </h3>
                <p className="text-sm text-neutral-400">
                  Your wallet has been credited immediately via Flutterwave.
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
          ) : (
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

              {/* Payment Gateway Selector */}
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-300">
                  Choose Payment Gateway
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Flutterwave Option */}
                  <button
                    type="button"
                    onClick={() => setGateway('flutterwave')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer relative ${
                      gateway === 'flutterwave'
                        ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 fill-current" />
                        Flutterwave
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 font-bold">
                        RECOMMENDED
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 font-sans leading-tight">
                      Bank Transfer, Cards (Visa/Mastercard/Verve), USSD, OPay & PalmPay.
                    </p>
                  </button>

                  {/* Paystack Option */}
                  <button
                    type="button"
                    onClick={() => setGateway('paystack')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      gateway === 'paystack'
                        ? 'bg-amber-500/10 border-amber-400 ring-1 ring-amber-400/50'
                        : 'bg-neutral-950/50 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-black uppercase text-neutral-200 flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5" />
                        Paystack
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300 font-sans leading-tight">
                      Cards, Bank Transfer, Apple Pay & Mobile Money.
                    </p>
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
                onClick={handleProceed}
                disabled={isProcessing || !selectedAmount || selectedAmount < 100}
                className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-sm uppercase tracking-wider cursor-pointer transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Opening {gateway === 'flutterwave' ? 'Flutterwave' : 'Paystack'}...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed with Flutterwave (₦{selectedAmount.toLocaleString()})</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>

              <div className="text-center">
                <span className="text-[10px] text-neutral-500 font-mono">
                  🔒 Secured 256-Bit SSL Escrow Gateway • Verified by Central Bank of Nigeria licensed partners
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
