import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import {
  ShieldCheck, Zap, Filter, Clock, CheckCircle2,
  AlertTriangle, AlertCircle, Trash2, RefreshCw, ArrowDownLeft,
  ArrowUpRight, Trophy, Building, Edit3
} from 'lucide-react';
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
  onCleanHistory?: (clearAll?: boolean) => Promise<void>;
}

export const WalletPage: React.FC<WalletPageProps> = ({
  currentUser,
  onUpdateUser,
  onCashOut,
  onCleanHistory,
}) => {
  const navigate = useNavigate();
  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);
  const [isFundModalOpen, setIsFundModalOpen] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PAYOUTS' | 'DEPOSITS' | 'WINNINGS'>('ALL');
  const [isCleaning, setIsCleaning] = useState(false);

  const filteredTransactions = currentUser.transactions.filter((t) => {
    if (filter === 'PAYOUTS') return t.type === 'WITHDRAWAL';
    if (filter === 'DEPOSITS') return t.type === 'DEPOSIT';
    if (filter === 'WINNINGS') return t.type === 'MATCH_WIN_PAYOUT' || t.type === 'REFERRAL_EARNING';
    return true;
  });

  const getStatusBadge = (tx: any) => {
    if (tx.type === 'WITHDRAWAL') {
      const desc = tx.description || '';
      if (desc.includes('cannot be processed') || desc.includes('Failed') || desc.includes('Flagged') || desc.includes('Declined')) {
        return { label: 'Flagged', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30', icon: AlertTriangle };
      }
      if (desc.includes('Pending') || desc.includes('Queued') || desc.includes('⏳')) {
        return { label: 'Processing', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Clock };
      }
      return { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
    }

    if (tx.type === 'DEPOSIT') {
      return { label: 'Credited', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
    }

    if (tx.type === 'MATCH_WIN_PAYOUT') {
      return { label: 'Won Wager', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Trophy };
    }

    if (tx.type === 'ESCROW_LOCK') {
      return { label: 'Escrow Locked', color: 'bg-neutral-800 text-neutral-400 border-neutral-700', icon: ShieldCheck };
    }

    return { label: 'Completed', color: 'bg-neutral-800 text-neutral-300 border-neutral-700', icon: CheckCircle2 };
  };

  const [cleanStatus, setCleanStatus] = useState<string | null>(null);

  const handleClean = async (clearAll: boolean) => {
    if (!onCleanHistory) return;
    setIsCleaning(true);
    setCleanStatus(null);
    try {
      await onCleanHistory(clearAll);
      setCleanStatus(clearAll ? 'Transaction history cleanly cleared.' : 'Ledger reconciled and duplicate records cleaned!');
      setTimeout(() => setCleanStatus(null), 4000);
    } catch (err: any) {
      setCleanStatus(err.message || 'Failed to reconcile history');
      setTimeout(() => setCleanStatus(null), 4000);
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* 1. Wallet Balance Hero Card */}
      <div className="p-6 rounded-3xl bg-neutral-900 border-2 border-emerald-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Available Wallet Balance</span>
            </div>
            <div className="text-3xl sm:text-4xl font-black text-white font-mono-nums">
              ₦{currentUser.balance.toLocaleString()}
            </div>
            {currentUser.bankName && currentUser.accountNumber ? (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-neutral-400 font-mono flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved Payout Bank: <strong className="text-neutral-200">{currentUser.bankName} ({currentUser.accountNumber} - {currentUser.accountName || currentUser.codmIgn})</strong></span>
                </span>
                <button
                  onClick={() => navigate('/profile')}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer ml-1 flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Change</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-xs text-amber-400 font-mono">
                  ⚠️ No bank details saved yet.
                </span>
                <button
                  onClick={() => navigate('/profile')}
                  className="text-xs text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                >
                  Link Bank Account in Profile →
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsFundModalOpen(true)}
              className="px-5 py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer uppercase flex items-center justify-center gap-2 active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>Top Up</span>
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

      {/* 2. Clean Transaction History Card */}
      <div className="bg-neutral-900 rounded-3xl border border-neutral-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div>
            <h3 className="text-lg font-black font-heading text-white uppercase tracking-wide">
              Financial Transaction Ledger
            </h3>
            <p className="text-xs text-neutral-400">
              Verified payouts, deposits, and escrow deductions
            </p>
          </div>

          {/* Action to clean/reconcile history */}
          {onCleanHistory && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleClean(false)}
                disabled={isCleaning}
                title="Deduplicate messy records and sync clean history"
                className="px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCleaning ? 'animate-spin text-amber-400' : ''}`} />
                <span>Reconcile & Clean</span>
              </button>

              <button
                type="button"
                onClick={() => handleClean(true)}
                disabled={isCleaning}
                title="Clear all transactions for a fresh clean history"
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear History</span>
              </button>
            </div>
          )}
        </div>

        {cleanStatus && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{cleanStatus}</span>
          </div>
        )}

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
              filter === 'ALL' ? 'bg-amber-400 text-neutral-950 font-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            All ({currentUser.transactions.length})
          </button>
          <button
            onClick={() => setFilter('PAYOUTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === 'PAYOUTS' ? 'bg-emerald-500 text-neutral-950 font-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Successful Payouts</span>
          </button>
          <button
            onClick={() => setFilter('DEPOSITS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === 'DEPOSITS' ? 'bg-blue-500 text-white font-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Deposits</span>
          </button>
          <button
            onClick={() => setFilter('WINNINGS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
              filter === 'WINNINGS' ? 'bg-amber-500 text-neutral-950 font-black' : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>Match Winnings</span>
          </button>
        </div>
        
        {/* Transactions List */}
        <div className="space-y-2.5">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12 px-4 rounded-2xl bg-neutral-950/60 border border-neutral-800/80 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-sm font-bold text-neutral-400">History is completely clean</p>
              <p className="text-xs text-neutral-500">No transactions found under this filter.</p>
            </div>
          ) : (
            filteredTransactions.map((tx) => {
              const badge = getStatusBadge(tx);
              const isDebit = tx.type === 'WITHDRAWAL' || tx.type === 'ESCROW_LOCK';

              return (
                <div
                  key={tx.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-neutral-950 rounded-2xl border border-neutral-800/90 hover:border-neutral-700 transition-all gap-3"
                >
                  <div className="flex items-start gap-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      tx.type === 'WITHDRAWAL'
                        ? 'bg-rose-500/10 text-rose-400'
                        : tx.type === 'DEPOSIT'
                        ? 'bg-blue-500/10 text-blue-400'
                        : tx.type === 'MATCH_WIN_PAYOUT'
                        ? 'bg-amber-500/10 text-amber-400'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {tx.type === 'WITHDRAWAL' ? (
                        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                      ) : tx.type === 'DEPOSIT' ? (
                        <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                      ) : tx.type === 'MATCH_WIN_PAYOUT' ? (
                        <Trophy className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm font-bold text-white leading-snug">
                        {tx.description}
                      </p>
                      <p className="text-[10px] text-neutral-500 font-mono mt-1">
                        {new Date(tx.timestamp).toLocaleString()} · ID: {tx.id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-neutral-900">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border ${badge.color}`}>
                      <badge.icon className="w-3 h-3" />
                      <span>{badge.label}</span>
                    </span>

                    <span className={`font-mono-nums font-black text-sm sm:text-base ${
                      isDebit ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      {isDebit ? '-' : '+'}₦{tx.amount.toLocaleString()}
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
