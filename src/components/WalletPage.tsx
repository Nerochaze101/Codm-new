import React, { useState } from 'react';
import { UserProfile } from '../types';
import { ShieldCheck, Zap, Filter, Clock, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
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
  const [filter, setFilter] = useState<'ALL' | 'PAYOUTS'>('ALL');

  const filteredTransactions = filter === 'PAYOUTS' 
    ? currentUser.transactions.filter(t => t.type === 'WITHDRAWAL')
    : currentUser.transactions;

  const getStatusBadge = (tx: any) => {
    // Mock status based on timestamp for demonstration
    const age = Date.now() - tx.timestamp;
    if (age < 60000) return { label: 'Processing', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Clock };
    if (age < 3600000) return { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
    return { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
  };

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

      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-white">Transactions</h3>
          <button
            onClick={() => setFilter(filter === 'ALL' ? 'PAYOUTS' : 'ALL')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filter === 'PAYOUTS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-neutral-800 text-neutral-400'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {filter === 'PAYOUTS' ? 'Show Successful Payouts' : 'All Transactions'}
          </button>
        </div>
        
        <div className="space-y-2">
          {filteredTransactions.length === 0 ? (
            <p className="text-sm text-neutral-500 text-center py-4">No transactions found.</p>
          ) : (
            filteredTransactions.map((tx) => {
              const badge = tx.type === 'WITHDRAWAL' ? getStatusBadge(tx) : null;
              return (
                <div key={tx.id} className="flex items-center justify-between p-4 bg-neutral-950 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-neutral-800 rounded-lg">
                      <Zap className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{tx.description}</p>
                      <p className="text-[10px] text-neutral-500 font-mono">{new Date(tx.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {badge && (
                      <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold border ${badge.color}`}>
                        <badge.icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    )}
                    <span className={`font-mono-nums font-bold ${tx.type === 'WITHDRAWAL' ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {tx.type === 'WITHDRAWAL' ? '-' : '+'}₦{tx.amount.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })
          )}
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
