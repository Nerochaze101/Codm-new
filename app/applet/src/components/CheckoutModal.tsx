import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  AlertCircle,
  Building2,
  Copy,
  Check,
  Loader2,
  Zap,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckSquare
} from 'lucide-react';

interface CheckoutModalProps {
  isOpen: boolean;
  amount: number;
  title: string;
  description: string;
  customer: {
    id?: string;
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
  const [step, setStep] = useState<number>(1); // Step 1: Review, Step 2: Bank Details & Instructions, Step 3: Session ID & Verification
  const [countdown, setCountdown] = useState<number>(899); // 15 mins checkout timer
  const [copiedAcc, setCopiedAcc] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationStep, setVerificationStep] = useState<string>('Verifying payment via Flutterwave Mail & Session ID...');
  const [error, setError] = useState<string | null>(null);

  // Deposit tracking
  const [depositReqId, setDepositReqId] = useState<string | null>(null);
  const [activePaymentRef, setActivePaymentRef] = useState<string>(reference);
  const [sessionReferenceInput, setSessionReferenceInput] = useState<string>('');
  
  // User profile bank details to save
  const [userBankName, setUserBankName] = useState<string>('');
  const [userAccountNo, setUserAccountNo] = useState<string>('');
  const [userAccountName, setUserAccountName] = useState<string>(customer.name || '');

  // Initialize real deposit request on modal open
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setStep(1);
      setCountdown(899);
      setIsVerifying(false);
      setError(null);
      setSessionReferenceInput('');
      setVerificationStep('Verifying payment via Flutterwave Mail & Session ID...');
      
      if (customer.id && amount >= 100) {
        fetch('/api/deposits/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: customer.id, amount }),
        })
          .then((res: Response) => res.json())
          .then((data: any) => {
            if (isMounted && data.deposit) {
              setDepositReqId(data.deposit.id);
              setActivePaymentRef(data.deposit.paymentReference);
            }
          })
          .catch((err: any) => {
            console.error('Deposit request init error:', err);
          });
      }
    } else {
      setDepositReqId(null);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, customer.id, amount]);

  // Countdown timer
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
    navigator.clipboard.writeText('9238778409');
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const handleCopyRef = () => {
    navigator.clipboard.writeText(activePaymentRef);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2000);
  };

  const handleVerifySession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReferenceInput || sessionReferenceInput.trim().length < 4) {
      setError('Please enter a valid Bank Transfer Session ID or Reference');
      return;
    }
    if (!depositReqId) {
      setError('Deposit request session not initialized. Please reopen checkout.');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setVerificationStep('Connecting to Gmail & Flutterwave Mail server (nerochazeagent@gmail.com)...');

    try {
      await new Promise((r) => setTimeout(r, 800));
      setVerificationStep(`Checking mail for Session ID: ${sessionReferenceInput} & Amount ₦${amount.toLocaleString()}...`);
      
      const response = await fetch('/api/deposits/verify-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          depositId: depositReqId,
          userId: customer.id,
          sessionReference: sessionReferenceInput.trim(),
          bankName: userBankName.trim() || undefined,
          accountNumber: userAccountNo.trim() || undefined,
          accountName: userAccountName.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || data.message || 'Payment verification failed');
      }

      setVerificationStep('✅ Payment Verified! Crediting wallet balance instantly...');
      await new Promise((r) => setTimeout(r, 1000));
      setIsVerifying(false);
      onSuccess(sessionReferenceInput.trim());
    } catch (err: any) {
      console.error('Verify session error:', err);
      setIsVerifying(false);
      setError(err.message || 'Failed to verify payment session');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
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
                  <ShieldCheck className="w-3 h-3" /> SECURE ESCROW
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

        {/* Amount & Step Tracker */}
        <div className="px-6 py-4 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Total Due Amount</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono-nums tracking-tight">
              ₦{amount.toLocaleString()}
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-mono uppercase text-amber-400 font-bold">
              Step {step} of 3
            </span>
            <span className="text-xs font-mono text-neutral-400">
              {step === 1 ? 'Review Details' : step === 2 ? 'Make Transfer' : 'Submit Session ID'}
            </span>
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
                  Verifying Real-Time Payment
                </h3>
                <p className="text-xs font-mono text-amber-300 max-w-sm mx-auto bg-neutral-950 p-3 rounded-xl border border-neutral-800">
                  {verificationStep}
                </p>
              </div>
              <p className="text-[11px] text-neutral-500 font-mono">
                Checking Flutterwave mail inbox for instant automated reconciliation...
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* STEP 1: REVIEW DEPOSIT DETAILS */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                      <span className="text-xs font-bold uppercase text-neutral-400 font-mono">Deposit Summary</span>
                      <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                        Zero Fees
                      </span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400">Account Holder:</span>
                        <span className="font-bold text-white font-mono">{customer.name}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400">Deposit Amount:</span>
                        <span className="font-bold text-amber-400 font-mono text-sm">₦{amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400">Destination Bank:</span>
                        <span className="font-bold text-white">Flutterwave MFB</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-neutral-400">Transfer Code / Ref:</span>
                        <span className="font-bold text-amber-400 font-mono">{activePaymentRef}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 uppercase font-heading">
                      <Zap className="w-4 h-4" /> Instant Real-Time Verification
                    </div>
                    <p className="leading-relaxed text-neutral-300">
                      Transfer the exact amount to our official Flutterwave MFB account in the next step, then submit your bank transfer Session ID for instant automated wallet crediting.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => { setError(null); setStep(2); }}
                    className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2"
                  >
                    <span>Proceed to Bank Transfer Instructions</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* STEP 2: TRANSFER INSTRUCTIONS */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-5 rounded-2xl bg-neutral-950 border-2 border-amber-400/60 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                      <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5 font-heading">
                        <Building2 className="w-4 h-4 text-amber-400" />
                        Official Flutterwave MFB Deposit Account
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                        DIRECT TRANSFER
                      </span>
                    </div>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between py-1">
                        <span className="text-neutral-400 font-mono">Bank Name:</span>
                        <span className="font-bold text-white text-sm">Flutterwave MFB</span>
                      </div>

                      <div className="flex items-center justify-between py-2 bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
                        <div>
                          <span className="text-[10px] uppercase text-neutral-400 block font-mono">Account Number</span>
                          <span className="text-2xl font-black text-amber-400 font-mono tracking-wider">9238778409</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyAccount}
                          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow"
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
                        <span className="font-bold text-white text-right">Quadri Abdulsalam</span>
                      </div>

                      <div className="flex items-center justify-between py-1.5 border-t border-neutral-900 pt-2">
                        <span className="text-neutral-400 font-mono">Exact Due Amount:</span>
                        <span className="font-black text-amber-400 font-mono text-lg">₦{amount.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-neutral-400 block font-mono">Unique Transfer Remark / Code</span>
                        <span className="font-mono font-bold text-white">{activePaymentRef}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyRef}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-mono font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedRef ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="px-4 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1.5"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                      <span>I Have Transferred - Enter Session ID</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: SUBMIT SESSION ID / REFERENCE & VERIFY */}
              {step === 3 && (
                <form onSubmit={handleVerifySession} className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-black uppercase text-white font-heading">
                        Step 3: Submit Bank Transfer Session ID
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed">
                      After transferring <strong className="text-amber-400 font-mono">₦{amount.toLocaleString()}</strong> to Flutterwave MFB (9238778409), copy the 10-12 digit <strong className="text-white">Session ID / Transaction Reference</strong> from your bank receipt and enter it below:
                    </p>

                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-300 font-mono">
                        Bank Transfer Session ID / Reference *
                      </label>
                      <input
                        type="text"
                        required
                        value={sessionReferenceInput}
                        onChange={(e) => setSessionReferenceInput(e.target.value)}
                        placeholder="e.g. 2026101618293847"
                        className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-white font-mono text-sm outline-none transition-all"
                      />
                    </div>

                    {/* Save user bank info to profile */}
                    <div className="pt-2 border-t border-neutral-900 space-y-3">
                      <span className="text-[11px] font-bold uppercase text-neutral-400 font-mono block">
                        Your Bank Details (Saved to profile for future payouts)
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={userBankName}
                          onChange={(e) => setUserBankName(e.target.value)}
                          placeholder="Your Bank Name (e.g. OPay, GTBank)"
                          className="px-3 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-amber-400 rounded-xl text-xs text-white font-mono outline-none"
                        />
                        <input
                          type="text"
                          value={userAccountNo}
                          onChange={(e) => setUserAccountNo(e.target.value)}
                          placeholder="Your Account Number (10 digits)"
                          className="px-3 py-2.5 bg-neutral-900 border border-neutral-800 focus:border-amber-400 rounded-xl text-xs text-white font-mono outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      disabled={isVerifying}
                      className="px-4 py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs uppercase tracking-wide cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-40"
                    >
                      <ArrowLeft className="w-4 h-4" /> Back
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifying || !sessionReferenceInput.trim()}
                      className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isVerifying ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Verifying Flutterwave Mail...</span>
                        </>
                      ) : (
                        <>
                          <CheckSquare className="w-4 h-4 stroke-[3]" />
                          <span>Verify & Credit Instantly (₦{amount.toLocaleString()})</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Secure Footer Note */}
              <div className="text-center pt-2">
                <span className="text-[10px] text-neutral-500 font-mono">
                  🔒 256-Bit Encrypted Escrow • Automated Flutterwave Mail Reconciliation
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
