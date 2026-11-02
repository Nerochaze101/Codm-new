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
  HelpCircle,
} from 'lucide-react';
import { createDepositRequest, checkDepositStatus, verifyDepositSession } from '../services/api';
import { calculateDepositFee } from '../utils/feeCalculator';
const sessionIdGuideImg = '/assets/aistudio/54A9305C-3D3B-4553-B59D-1507F13A6CDD_66112ba4.png';

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
  const [activePaymentRef, setActivePaymentRef] = useState<string>(() => reference || `OPS-${Date.now().toString(36).toUpperCase()}`);
  const [autoConfirmed, setAutoConfirmed] = useState<boolean>(false);
  const [sessionInput, setSessionInput] = useState<string>("");
  const [showSessionHelpModal, setShowSessionHelpModal] = useState<boolean>(false);

  const feeCalc = calculateDepositFee(amount);

  // Initialize real deposit request on modal open
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      setCountdown(899);
      setIsVerifying(false);
      setError(null);
      setAutoConfirmed(false);
      setVerificationStep('Awaiting payment transfer...');

      const initialRef = reference || `OPS-${Date.now().toString(36).toUpperCase()}`;
      setActivePaymentRef(initialRef);

      // Create pending deposit request in DB if customer ID provided
      if (customer.id && amount >= 100) {
        createDepositRequest(customer.id, amount)
          .then((res) => {
            if (isMounted && res.deposit) {
              setDepositReqId(res.deposit.id);
              if (res.deposit.paymentReference) {
                setActivePaymentRef(res.deposit.paymentReference);
              }
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
  }, [isOpen, customer.id, amount, reference]);

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
            setVerificationStep('Payment confirmed! Updating your wallet balance...');
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

  const handleVerifySession = async () => {
    if (!sessionInput.trim()) {
      setError("Please enter your transaction session ID or reference.");
      return;
    }
    setError(null);
    setIsVerifying(true);
    setVerificationStep("Verifying your transfer with the bank...");
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
        setVerificationStep("Payment confirmed! Crediting your wallet...");
        setTimeout(() => {
          setIsVerifying(false);
          onSuccess(sessionInput, res.newBalance);
        }, 1000);
      } else {
        throw new Error(res.error || "Payment verification failed.");
      }
    } catch (err: any) {
      setIsVerifying(false);
      setError(err.message || "Could not verify your transfer. Please check your session reference and try again.");
    }
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
            <span className="text-[10px] font-mono uppercase text-neutral-400 block">Total Due Amount (Incl. ₦{feeCalc.totalFee.toFixed(2)} Fee)</span>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono-nums tracking-tight">
              ₦{feeCalc.totalPayable.toLocaleString(undefined, { minimumFractionDigits: feeCalc.totalPayable % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}
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
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

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

                    <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-neutral-900 border border-neutral-800">
                      <div className="min-w-0 pr-2">
                        <span className="text-[10px] uppercase text-neutral-400 block font-mono">Payment / Session Reference</span>
                        <span className="text-xs font-mono font-bold text-amber-400 select-all truncate block">{activePaymentRef}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(activePaymentRef);
                          setCopiedRef(true);
                          setTimeout(() => setCopiedRef(false), 2000);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-mono text-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-all active:scale-95"
                      >
                        {copiedRef ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy Ref</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-1 text-xs">
                      <span className="text-neutral-400 font-mono">Wallet Credit:</span>
                      <span className="font-bold text-white font-mono">₦{amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between py-1 text-xs">
                      <span className="text-neutral-400 font-mono">Processing Fee:</span>
                      <span className="font-bold text-amber-300 font-mono">₦{feeCalc.totalFee.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5 border-t border-neutral-800 pt-2">
                      <span className="text-neutral-400 font-mono font-bold">Exact Due Amount:</span>
                      <span className="font-black text-amber-400 font-mono text-base">₦{feeCalc.totalPayable.toLocaleString(undefined, { minimumFractionDigits: feeCalc.totalPayable % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed pt-1">
                    Transfer exactly <strong className="text-amber-400 font-mono">₦{feeCalc.totalPayable.toLocaleString(undefined, { minimumFractionDigits: feeCalc.totalPayable % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}</strong> from your OPay or bank app to the account above, then click the confirmation button below.
                  </p>

                  <div className="flex flex-col gap-4 pt-4 border-t border-neutral-800">
                    <div className="p-5 rounded-2xl bg-sky-500/10 border-2 border-sky-500/40 space-y-4 shadow-xl">
                       <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400">
                                <ShieldCheck className="w-5 h-5" />
                             </div>
                             <label className="block text-xs font-black uppercase text-white tracking-wider">
                                Confirm Your Transfer
                             </label>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowSessionHelpModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase rounded-xl transition-all shadow-lg active:scale-95 cursor-pointer border-b-2 border-amber-600"
                          >
                            <HelpCircle className="w-4 h-4" />
                            <span>How to get Session ID?</span>
                          </button>
                       </div>
                       
                       <div className="space-y-2">
                          <div className="relative group">
                             <input
                               type="text"
                               value={sessionInput}
                               onChange={(e) => setSessionInput(e.target.value)}
                               placeholder="Paste Transaction Session ID or Reference"
                               className="w-full p-4.5 bg-black border-2 border-neutral-800 rounded-2xl text-white font-mono text-sm focus:border-sky-500 outline-none transition-all placeholder:text-neutral-700 shadow-inner group-hover:border-neutral-700"
                             />
                             <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                               {sessionInput.length > 5 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                             </div>
                          </div>
                          <p className="text-[10px] text-neutral-500 leading-relaxed pl-1">
                            Find the <strong>Session ID</strong> on your bank/OPay success receipt and paste it above to credit your wallet instantly.
                          </p>
                       </div>

                       <button
                         type="button"
                         onClick={handleVerifySession}
                         disabled={isVerifying || !sessionInput.trim()}
                         className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-2xl text-xs sm:text-sm uppercase tracking-widest cursor-pointer transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 active:scale-[0.98] border-b-4 border-emerald-700 hover:border-emerald-600"
                       >
                         {isVerifying ? (
                           <Loader2 className="w-5 h-5 animate-spin" />
                         ) : (
                           <Zap className="w-5 h-5 fill-current" />
                         )}
                         <span>{isVerifying ? 'RECONCILING WITH BANK...' : 'I HAVE MADE THE TRANSFER - VERIFY NOW'}</span>
                       </button>
                    </div>
                  </div>
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

      {/* Session ID Help Image Popup Modal */}
      {showSessionHelpModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-neutral-900 border-2 border-sky-500/50 rounded-3xl p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2 text-sky-400 font-bold uppercase text-xs">
                <HelpCircle className="w-5 h-5" />
                <span>How to Get Your Session ID</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSessionHelpModal(false)}
                className="p-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed">
              Open your bank or OPay transaction receipt. Look for the <strong className="text-amber-400">Session ID</strong> field and tap the copy button indicated by the red arrow in the guide below:
            </p>

            <div className="rounded-2xl overflow-hidden border border-neutral-800 bg-black shadow-inner">
              <img
                src={sessionIdGuideImg}
                alt="How to get Session ID from transaction receipt"
                className="w-full h-auto object-contain max-h-[60vh] mx-auto"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowSessionHelpModal(false)}
              className="w-full py-3 bg-sky-500 hover:bg-sky-400 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider cursor-pointer shadow-lg transition-all"
            >
              Got It / Return to Submit Session ID
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
