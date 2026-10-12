import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ShieldCheck, Zap } from 'lucide-react';
import { CashOutModal } from './CashOutModal';
import { FundWalletModal } from './FundWalletModal';

interface WalletPageProps {
  currentUser: UserProfile;
  onUpdateUser?: (updatedData: Partial<UserProfile>) => Promise<void>;
  onCashOut?: (
    amount: number,
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      gateway?: 'flutterwave' | 'paystack';
    }
  ) => Promise<void>;
}

export const WalletPage: React.FC<WalletPageProps> = ({
  currentUser,
  onUpdateUser,
  onCashOut,
}) => {
  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      <div className="p-6 rounded-3xl bg-neutral-900 border-2 border-emerald-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Available Wallet Balance</span>
            </div>
            <div className="text-3xl font-black text-white font-mono-nums">
              ₦{currentUser.balance.toLocaleString()}
            </div>
            {currentUser.bankName && currentUser.accountNumber ? (
              <p className="text-xs text-neutral-400 font-mono">
                Saved Payout Bank: <strong className="text-neutral-200">{currentUser.bankName} ({currentUser.accountNumber} - {currentUser.accountName || currentUser.codmIgn})</strong>
              </p>
            ) : (
              <p className="text-xs text-amber-400 font-mono">
                ⚠️ No bank details saved yet. Edit profile to save bank details before cashing out.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsFundModalOpen(true)}
              className="px-5 py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer uppercase flex items-center justify-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Fund</span>
            </button>

            <button
              onClick={() => {
                if (currentUser.balance <= 0) {
                  alert('No available balance to cash out.');
                  return;
                }
                setIsCashOutModalOpen(true);
              }}
              disabled={currentUser.balance <= 0}
              className="px-5 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Cash Out</span>
            </button>
          </div>
        </div>
      </div>

      <FundWalletModal
        isOpen={isFundModalOpen}
        currentUser={currentUser}
        onClose={() => setIsFundModalOpen(false)}
        onSuccessDeposit={async (newBalance) => {
          if (onUpdateUser) {
            await onUpdateUser({ balance: newBalance });
          }
        }}
      />

      <CashOutModal
        isOpen={isCashOutModalOpen}
        currentUser={currentUser}
        onClose={() => setIsCashOutModalOpen(false)}
        onSaveBankInfo={async (details) => {
          if (onUpdateUser) {
            await onUpdateUser(details);
          }
        }}
        onConfirmCashOut={async (amount, details) => {
          if (onCashOut) {
            await onCashOut(amount, details);
          }
        }}
      />
    </div>
  );
};
