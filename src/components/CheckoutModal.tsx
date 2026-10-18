import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Building2,
  Copy,
  Check,
  Loader2,
  Zap,
  Clock,
  Radio,
  Smartphone,
} from 'lucide-react';
import { createDepositRequest, checkDepositStatus, verifyDepositSession } from '../services/api';

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
  onSuccess: (ref: string, verifiedBalance?: number) => void;
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
  const [countdown, setCountdown] = useState<number>(899); // 15 mins checkout timer
  const [copiedAcc, setCopiedAcc] = useState<boolean>(false);
  const [copiedRef, setCopiedRef] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationStep, setVerificationStep] = useState<string>('Awaiting payment transfer...');
  const [error, setError] = useState<string | null>(null);

  // Automated OPay SMS deposit tracking
  const [depositReqId, setDepositReqId] = useState<string | null>(null);
  const [activePaymentRef, setActivePaymentRef] = useState<string>(reference);
  const [autoConfirmed, setAutoConfirmed] = useState<boolean>(false);
  const [sessionInput, setSessionInput] = useState<string>("");
  const [showSessionPrompt, setShowSessionPrompt] = useState<boolean>(false);

  // Initialize real deposit request on modal open
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setCountdown(899);
      setIsVerifying(false);
      setError(null);
      setAutoConfirmed(false);
      setVerificationStep('Awaiting payment transfer...');

      // Create pending deposit request in DB if customer ID provided
      if (customer.id && amount >= 100) {
        createDepositRequest(customer.id, amount)
          .then((res) => {
            if (isMounted && res.deposit) {
              setDepositReqId(res.deposit.id);
              setActivePaymentRef(res.deposit.paymentReference);
            }
          })
          .catch((err) => {
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

  // Live polling for automated OPay SMS verification
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    if (isOpen && depositReqId && !autoConfirmed && !isVerifying) {
      pollInterval = setInterval(async () => {
        try {
          const status = await checkDepositStatus(depositReqId);
          if (status.completed) {
            setAutoConfirmed(true);
            setIsVerifying(true);
            setVerificationStep('⚡ OPay SMS Alert Detected! Crediting wallet balance...');
            setTimeout(() => {
              setIsVerifying(false);
              onSuccess(activePaymentRef, status.balance);
            }, 1200);
          }
        } catch (e) {
          // Silent polling error
        }
      }, 3500);
    }
    return () => clearInterval(pollInterval);
  }, [isOpen, depositReqId, autoConfirmed, isVerifying, activePaymentRef, onSuccess]);

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

  
  const handleVerifySession = async () => {
    if (!sessionInput.trim()) {
      setError("Please enter your transaction session ID or reference.");
      return;
    }
    setError(null);
    setIsVerifying(true);
    setVerificationStep("Verifying session reference & Flutterwave mail...");
    try {
      let reqId = depositReqId;
      if (!reqId) {
        if (!customer.id) {
          throw new Error("User session not found. Please log in again.");
        }
        const initRes = await createDepositRequest(customer.id, amount);
        if (initRes && initRes.deposit) {
          reqId = initRes.deposit.id;
          setDepositReqId(reqId);
        } else {
          throw new Error("Failed to initialize deposit request. Please try again.");
        }
      }
      const res = await verifyDepositSession(
        reqId,
        customer.id || "",
        sessionInput,
        "Flutterwave MFB",
        "9238778409",
        customer.name
      );
      if (res.success) {
        setVerificationStep("Payment verified! Crediting wallet...");
        setTimeout(() => {
          setIsVerifying(false);
          onSuccess(sessionInput, res.newBalance);
        }, 1000);
      } else {
        throw new Error(res.error || "Payment verification failed.");
      }
    } catch (err: any) {
      setIsVerifying(false);
      setError(err.message || "Verification failed. Make sure you submitted the correct session reference.");
    }
  };

  const handleSimulateWebhookSuccess = async () => {
    setIsVerifying(true);
    setError(null);

    setVerificationStep('Connecting to OPay & Bank Reconciliation Gateway...');
    await new Promise((r) => setTimeout(r, 800));

    setVerificationStep('Verifying bank transfer webhook payload...');
    await new Promise((r) => setTimeout(r, 1000));

    setVerificationStep('Payment confirmed! Crediting wallet & locking escrow...');
    await new Promise((r) => setTimeout(r, 700));

    setIsVerifying(false);
    onSuccess(activePaymentRef);
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
              {/* Error banner */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* OPay Direct Bank Transfer Checkout (Only Bank Transfer as requested) */}
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="p-5 rounded-2xl bg-neutral-950 border-2 border-amber-400/60 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <span className="text-xs font-black uppercase text-amber-400 flex items-center gap-1.5 font-heading">
                      <Building2 className="w-4 h-4 text-amber-400" />
                      Transfer to OPay Checkout Account
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">
                      DIRECT BANK TRANSFER
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between py-1">
                      <span className="text-neutral-400 font-mono">Bank Name:</span>
                      <span className="font-bold text-white">Flutterwave MFB</span>
                    </div>

                    <div className="flex items-center justify-between py-1.5 bg-neutral-900 p-3.5 rounded-xl border border-neutral-800">
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
                      <span className="font-black text-amber-400 font-mono text-base">₦{amount.toLocaleString()}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                    Transfer exactly <strong className="text-amber-400 font-mono">₦{amount.toLocaleString()}</strong> from your OPay or bank app to the account above, then click the confirmation button below.
                  </p>

                  
                  {!showSessionPrompt ? (
                    <button
                      type="button"
                      onClick={() => setShowSessionPrompt(true)}
                      className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-xl flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>I Have Made the Transfer</span>
                    </button>
                  ) : (
                    <div className="space-y-3 pt-2 border-t border-neutral-800 animate-in fade-in duration-200">
                      <div>
                        <label className="block text-[11px] font-mono uppercase text-amber-400 font-bold mb-1.5">
                          Enter Transfer Session ID / Reference
                        </label>
                        <input
                          type="text"
                          value={sessionInput}
                          onChange={(e) => setSessionInput(e.target.value)}
                          placeholder="e.g. 20261017... or Ref ID"
                          className="w-full p-3 bg-neutral-900 border border-neutral-700 rounded-xl text-white font-mono text-xs focus:border-amber-450 outline-none"
                        />
                        <p className="text-[10px] text-neutral-400 mt-1">
                          System will instantly verify session ID with Flutterwave email & credit your wallet.
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowSessionPrompt(false)}
                          className="px-4 py-3 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 font-bold rounded-xl text-xs uppercase cursor-pointer"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifySession}
                          className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                          <Zap className="w-4 h-4 fill-current" />
                          <span>Submit & Verify Instantly</span>
                        </button>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* Secure Footer Note */}
              <div className="text-center pt-2">
                <span className="text-[10px] text-neutral-500 font-mono">
                  🔒 256-Bit Encrypted Bank Transfer Escrow • Instant Automated Reconciliation
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
