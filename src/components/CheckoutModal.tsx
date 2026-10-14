import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Building2,
  Smartphone,
  Copy,
  Check,
  Loader2,
  Lock,
  Zap,
  Clock,
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  amount: number;
  title: string;
  description: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  reference: string;
  onSuccess: (ref: string) => void;
  onClose: () => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  amount,
  title,
  description,
  customer,
  reference,
  onSuccess,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'opay_transfer' | 'card' | 'ussd'>('opay_transfer');
  const [countdown, setCountdown] = useState<number>(899); // 15 mins checkout timer
  const [copiedAcc, setCopiedAcc] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationStep, setVerificationStep] = useState<string>('Awaiting payment transfer...');
  const [cardDetails, setCardDetails] = useState({ number: '', expiry: '', cvv: '', pin: '' });
  const [ussdBank, setUssdBank] = useState<string>('opay');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCountdown(899);
      setActiveTab('opay_transfer');
      setIsVerifying(false);
      setError(null);
      setVerificationStep('Awaiting payment transfer...');
    }
  }, [isOpen]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('7079874999');
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const handleSimulateWebhookSuccess = async () => {
    setIsVerifying(true);
    setError(null);

    setVerificationStep('Connecting to OPay & Flutterwave Gateway...');
    await new Promise((r) => setTimeout(r, 900));

    setVerificationStep('Verifying bank transfer webhook payload...');
    await new Promise((r) => setTimeout(r, 1100));

    setVerificationStep('Payment confirmed! Crediting wallet & locking escrow...');
    await new Promise((r) => setTimeout(r, 800));

    setIsVerifying(false);
    onSuccess(reference);
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardDetails.number || cardDetails.number.length < 15) {
      setError('Please enter a valid debit card number');
      return;
    }
    setIsVerifying(true);
    setError(null);

    setVerificationStep('Authorizing secure card transaction...');
    await new Promise((r) => setTimeout(r, 1000));

    setVerificationStep('Processing 3D Secure verification...');
    await new Promise((r) => setTimeout(r, 1200));

    setIsVerifying(false);
    onSuccess(reference);
  };

  const handleUssdSubmit = async () => {
    setIsVerifying(true);
    setError(null);

    setVerificationStep(`Dialing *955*${amount}# via ${ussdBank.toUpperCase()}...`);
    await new Promise((r) => setTimeout(r, 1500));

    setVerificationStep('Awaiting USSD PIN authorization...');
    await new Promise((r) => setTimeout(r, 1200));

    setIsVerifying(false);
    onSuccess(reference);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Checkout Header Banner */}
        <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-neutral-950 p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
              <Zap className="w-6 h-6 fill-current animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white font-heading tracking-wide">
                  {title}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> SECURE CHECKOUT
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono">
                {description}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isVerifying}
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount & Timer Bar */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Total Due Amount</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono-nums tracking-tight">
              ₦{amount.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-mono uppercase text-neutral-400 flex items-center gap-1 justify-end">
              <Clock className="w-3 h-3 text-amber-400" /> Session Expires
            </span>
            <div className="text-lg font-black font-mono text-white">
              {formatTime(countdown)}
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-neutral-900/50">
          {isVerifying ? (
            <div className="py-12 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-400 text-amber-400 flex items-center justify-center mx-auto shadow-xl shadow-amber-500/20">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-white uppercase font-heading tracking-wide">
                  Processing Checkout
                </h3>
                <p className="text-xs font-mono text-amber-300 max-w-sm mx-auto bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                  {verificationStep}
                </p>
              </div>
              <p className="text-[11px] text-neutral-500 font-mono">
                Please do not close this window while we verify your transaction.
              </p>
            </div>
          ) : (
            <>
              {/* Payment Method Tabs */}
              <div className="grid grid-cols-3 gap-2 p-1.5 bg-neutral-950 rounded-2xl border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('opay_transfer')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'opay_transfer'
                      ? 'bg-amber-400 text-neutral-950 shadow-md font-black'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>OPay Transfer</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'card'
                      ? 'bg-amber-400 text-neutral-950 shadow-md font-black'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Card / Bank</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('ussd')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold font-heading transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeTab === 'ussd'
                      ? 'bg-amber-400 text-neutral-950 shadow-md font-black'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>USSD Code</span>
                </button>
              </div>

              {/* Error banner */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* TAB 1: OPay Direct Bank Transfer Checkout */}
              {activeTab === 'opay_transfer' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-neutral-950 border-2 border-amber-400/50 space-y-3.5 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                      <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5 font-heading">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        Transfer to OPay Checkout Account
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        INSTANT MATCH
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-neutral-400 font-mono">Bank Name:</span>
                        <span className="font-bold text-white">OPay Digital Services Limited (OPay)</span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 bg-neutral-900 p-3 rounded-xl border border-neutral-800">
                        <div>
                          <span className="text-[10px] uppercase text-neutral-400 block font-mono">Account Number</span>
                          <span className="text-xl font-black text-amber-400 font-mono tracking-wider">7079874999</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyAccount}
                          className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow"
                        >
                          {copiedAcc ? (
                            <>
                              <Check className="w-4 h-4 stroke-[3]" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4" />
                              <span>Copy No.</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-neutral-400 font-mono">Account Name:</span>
                        <span className="font-bold text-white text-right">QUADRI OPEYEMI ABDULSALAM</span>
                      </div>

                      <div className="flex items-center justify-between py-1 border-t border-neutral-900 pt-2">
                        <span className="text-neutral-400 font-mono">Exact Amount:</span>
                        <span className="font-black text-amber-400 font-mono text-sm">₦{amount.toLocaleString()}</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                      Transfer exactly <strong className="text-amber-400 font-mono">₦{amount.toLocaleString()}</strong> from your OPay or bank app to the account above, then click the confirmation button below.
                    </p>

                    <button
                      type="button"
                      onClick={handleSimulateWebhookSuccess}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>I Have Made the Transfer (Verify & Complete)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: Card Checkout */}
              {activeTab === 'card' && (
                <form onSubmit={handleCardSubmit} className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-neutral-300 uppercase font-heading">
                        Card Number
                      </label>
                      <div className="relative">
                        <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="4342 •••• •••• 8821"
                          value={cardDetails.number}
                          onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 focus:border-amber-400 rounded-xl text-white font-mono text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-300 uppercase font-heading">
                          Expiry Date
                        </label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          value={cardDetails.expiry}
                          onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 focus:border-amber-400 rounded-xl text-white font-mono text-sm outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-xs font-bold text-neutral-300 uppercase font-heading">
                          CVV / CVC
                        </label>
                        <input
                          type="password"
                          maxLength={4}
                          placeholder="123"
                          value={cardDetails.cvv}
                          onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                          className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 focus:border-amber-400 rounded-xl text-white font-mono text-sm outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Pay ₦{amount.toLocaleString()} Securely</span>
                  </button>
                </form>
              )}

              {/* TAB 3: USSD Code Checkout */}
              {activeTab === 'ussd' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
                    <label className="block text-xs font-bold text-neutral-300 uppercase font-heading">
                      Select Your Bank for USSD Code
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'opay', name: 'OPay (*955#)', code: `*955*1*${amount}#` },
                        { id: 'gtb', name: 'GTBank (*737#)', code: `*737*2*${amount}#` },
                        { id: 'zenith', name: 'Zenith (*966#)', code: `*966*2*${amount}#` },
                        { id: 'first', name: 'FirstBank (*894#)', code: `*894*2*${amount}#` },
                      ].map((bank) => (
                        <button
                          key={bank.id}
                          type="button"
                          onClick={() => setUssdBank(bank.id)}
                          className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            ussdBank === bank.id
                              ? 'bg-amber-500/10 border-amber-400 text-white font-bold'
                              : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                          }`}
                        >
                          <div className="text-xs font-bold text-white">{bank.name}</div>
                          <div className="text-[10px] font-mono text-amber-400 mt-1">{bank.code}</div>
                        </button>
                      ))}
                    </div>

                    <div className="p-3 bg-neutral-900 rounded-xl border border-neutral-800 text-center space-y-1">
                      <span className="text-[10px] uppercase text-neutral-400 font-mono block">Dial Code on your phone</span>
                      <div className="text-lg font-black font-mono text-amber-400 tracking-wider">
                        {ussdBank === 'opay' && `*955*1*${amount}#`}
                        {ussdBank === 'gtb' && `*737*2*${amount}#`}
                        {ussdBank === 'zenith' && `*966*2*${amount}#`}
                        {ussdBank === 'first' && `*894*2*${amount}#`}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleUssdSubmit}
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>I Have Dialed & Approved (Complete Payment)</span>
                  </button>
                </div>
              )}

              {/* Secure Footer Note */}
              <div className="text-center pt-2">
                <span className="text-[10px] text-neutral-500 font-mono">
                  🔒 256-Bit Encrypted Checkout • Instant Settlement via OPay & Flutterwave
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
