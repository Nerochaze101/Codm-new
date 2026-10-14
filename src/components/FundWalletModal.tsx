import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  X,
  Zap,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Loader2,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { depositWallet } from '../services/api';
import { CheckoutModal } from './CheckoutModal';

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
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ amount: number; balance: number; txId: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSuccessInfo(null);
      setErrorMessage(null);
      setIsProcessing(false);
      setIsCheckoutOpen(false);
    }
  }, [isOpen]);

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

  const handleOpenCheckout = () => {
    const amountToFund = parseInt(customAmount, 10);
    if (isNaN(amountToFund) || amountToFund < 100) {
      setErrorMessage('Minimum deposit amount is ₦100');
      return;
    }
    setErrorMessage(null);
    setIsCheckoutOpen(true);
  };

  const handleCheckoutSuccess = async (ref: string) => {
    const amountToFund = parseInt(customAmount, 10);
    setIsCheckoutOpen(false);
    setIsProcessing(true);

    try {
      const result = await depositWallet(currentUser.id, amountToFund, 'OPay / Flutterwave Secure Checkout', ref, ref);
      setIsProcessing(false);
      setSuccessInfo({
        amount: amountToFund,
        balance: result.balance,
        txId: result.transaction?.id || ref,
      });
      onSuccessDeposit(result.balance, amountToFund);
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMessage(err.message || 'Deposit crediting failed. Please contact support.');
    }
  };

  const handleClose = () => {
    setSuccessInfo(null);
    setErrorMessage(null);
    setIsProcessing(false);
    setIsCheckoutOpen(false);
    onClose();
  };

  const amountNumber = parseInt(customAmount || '0', 10);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
        <div className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/80">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h2 className="text-base font-black text-white font-heading uppercase tracking-wide">
                  Fund Esports Wallet
                </h2>
                <p className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>OPay Checkout Link & Flutterwave Escrow</span>
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
              <div className="text-center py-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20 animate-bounce">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-white uppercase font-heading">
                    Deposit Successful!
                  </h3>
                  <p className="text-sm text-neutral-400">
                    Your wallet has been instantly credited via secure checkout.
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
                    <span>Transaction Reference:</span>
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
                    Select Deposit Amount (₦)
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
                </div>

                {/* OPay & Flutterwave Checkout Banner Preview */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 border-2 border-amber-400/60 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5 font-heading">
                      <Lock className="w-4 h-4 text-amber-400" />
                      OPay & Flutterwave Checkout Link
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      INSTANT POPUP
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between py-1 text-neutral-300">
                      <span>Destination Account:</span>
                      <strong className="text-white font-mono">OPay (7079874999)</strong>
                    </div>
                    <div className="flex items-center justify-between py-1 text-neutral-300">
                      <span>Account Name:</span>
                      <strong className="text-white font-mono">QUADRI OPEYEMI ABDULSALAM</strong>
                    </div>
                    <div className="flex items-center justify-between py-1 text-neutral-300 border-t border-neutral-800 pt-2">
                      <span>Gateway Mode:</span>
                      <span className="text-amber-400 font-bold">Checkout Link / Transfer / Card / USSD</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleOpenCheckout}
                    disabled={isProcessing || amountNumber < 100}
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs sm:text-sm uppercase tracking-wide cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Processing Deposit...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 fill-current" />
                        <span>Proceed to Checkout Link (₦{amountNumber.toLocaleString()})</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>

                {/* Error Box */}
                {errorMessage && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

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

      {/* Checkout Gateway Link Modal */}
      <CheckoutModal
        isOpen={isCheckoutOpen}
        amount={amountNumber}
        title="Fund Esports Wallet"
        description="Instant deposit via OPay, Transfer, Card, or USSD"
        customer={{
          name: currentUser.accountName || currentUser.codmIgn,
          email: currentUser.email || `${currentUser.codmIgn.toLowerCase()}@player.ng`,
          phone: currentUser.phone || '08000000000',
        }}
        reference={`CHECKOUT_DEP_${Date.now()}`}
        onSuccess={handleCheckoutSuccess}
        onClose={() => setIsCheckoutOpen(false)}
      />
    </>
  );
};
