import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  AlertCircle,
  Building2,
  Copy,
  Check,
  Loader2,
  Zap,
  Clock,
  CheckCircle2,
  KeyRound
} from 'lucide-react';

export const CheckoutModal = ({ title, description, amount, onClose, onVerify }: { title: string, description: string, amount: number, onClose: () => void, onVerify: (sessionId: string) => Promise<any> }) => {
  const [sessionId, setSessionId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [copiedAcc, setCopiedAcc] = useState(false);

  const handleCopyAccount = () => {
    navigator.clipboard.writeText('9238778409');
    setCopiedAcc(true);
    setTimeout(() => setCopiedAcc(false), 2000);
  };

  const handleVerify = async () => {
    if (!sessionId.trim()) {
      setError('Please enter your transfer session ID or reference.');
      return;
    }
    setError('');
    setIsVerifying(true);
    try {
      await onVerify(sessionId);
    } catch (err: any) {
      setError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="bg-neutral-950 p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap className="w-6 h-6 fill-current" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">{title}</h2>
              <p className="text-xs text-neutral-400">{description}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto">
          {isVerifying ? (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-amber-400 mx-auto" />
              <p className="mt-4 text-white">Verifying transaction...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {error && <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-lg">{error}</div>}
              
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Bank: Flutterwave MFB</span>
                  <span>Amount: ₦{amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-900 rounded-lg">
                  <span className="text-xl font-bold text-amber-400">9238778409</span>
                  <button onClick={handleCopyAccount} className="text-xs text-neutral-400 flex items-center gap-1">
                    <Copy className="w-3 h-3" /> {copiedAcc ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[10px] text-neutral-500">Transfer exactly ₦{amount.toLocaleString()} to this account.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-neutral-400 flex items-center gap-1">
                  <KeyRound className="w-3 h-3" /> Enter Transaction Session ID / Reference
                </label>
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-white text-sm"
                  placeholder="e.g. 1234567890"
                />
              </div>

              <button onClick={handleVerify} className="w-full py-4 bg-emerald-500 text-neutral-950 font-black rounded-lg uppercase flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> Verify & Credit Instantly
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
