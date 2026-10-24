import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import {
  ShieldCheck, Zap, Filter, Clock, CheckCircle2,
  AlertTriangle, AlertCircle, Trash2, RefreshCw, ArrowDownLeft,
  ArrowUpRight, Trophy, Building, Edit3, Wallet, CreditCard,
  TrendingUp, History as HistoryIcon, Landmark, Shield
} from 'lucide-react';
import { CashOutModal } from './CashOutModal';
import { FundWalletModal } from './FundWalletModal';
import { CODM_IMAGES } from '../assets/images';

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
        return { label: 'FLAGGED', color: 'bg-rose-500/10 text-rose-400 border-rose-500/30', icon: AlertTriangle };
      }
      if (desc.includes('Pending') || desc.includes('Queued') || desc.includes('⏳')) {
        return { label: 'PROCESSING', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Clock };
      }
      return { label: 'COMPLETED', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
    }

    if (tx.type === 'DEPOSIT') {
      return { label: 'CREDITED', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 };
    }

    if (tx.type === 'MATCH_WIN_PAYOUT') {
      return { label: 'WON WAGER', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30', icon: Trophy };
    }

    if (tx.type === 'ESCROW_LOCK') {
      return { label: 'ESCROW LOCKED', color: 'bg-neutral-800 text-neutral-400 border-neutral-700', icon: ShieldCheck };
    }

    return { label: 'COMPLETED', color: 'bg-neutral-800 text-neutral-300 border-neutral-700', icon: CheckCircle2 };
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
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* 1. Wallet Balance Hero Card (Tactical Card) */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-neutral-900 border-2 border-emerald-500/40 p-8 sm:p-12 shadow-2xl group">
        {/* Ambient tactical backgrounds */}
        <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none">
          <img src={CODM_IMAGES.cardBgSubtle} alt="" className="w-full h-full object-cover grayscale" />
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-black/80" />
        </div>
        
        {/* Animated corner glows */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-500/15 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px] animate-pulse" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
            <div className="relative shrink-0">
              <div className="w-32 h-32 rounded-[2rem] bg-neutral-950 border-4 border-emerald-400 flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
                <Wallet size={64} />
              </div>
              <div className="absolute -bottom-3 -right-3 px-4 py-1 rounded-xl bg-black border-2 border-emerald-400 text-[10px] font-black font-mono text-emerald-400 shadow-xl tracking-tighter uppercase">
                SECURE
              </div>
            </div>

            <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <h1 className="font-heading font-black text-4xl sm:text-5xl text-white tracking-tighter uppercase leading-none">
                    War Chest
                  </h1>
                  <div className="px-4 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] font-black tracking-[0.2em] flex items-center gap-2 shadow-lg uppercase">
                    <ShieldCheck size={14} className="animate-bounce" />
                    Ledger Verified
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 pt-2">
                   <div className="text-5xl sm:text-6xl font-black text-white font-mono-nums tracking-tighter flex items-baseline gap-2">
                      <span className="text-emerald-400 text-3xl sm:text-4xl">₦</span>
                      {currentUser.balance.toLocaleString()}
                   </div>
                   <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-neutral-800 text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                     Escrow Locked: <span className="text-amber-400 font-black">₦{currentUser.escrowBalance.toLocaleString()}</span>
                   </div>
                </div>
              </div>

              {currentUser.bankName && currentUser.accountNumber ? (
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                  <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-black/40 border border-neutral-800 backdrop-blur-md">
                    <Landmark size={18} className="text-emerald-400" />
                    <div className="text-left">
                      <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em]">Settlement Target</p>
                      <p className="text-xs font-black text-neutral-200 uppercase tracking-tight">{currentUser.bankName} · {currentUser.accountNumber}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/profile')}
                    className="p-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all active:scale-90 border border-neutral-700 shadow-xl"
                    title="Change Settlement Bank"
                  >
                    <Edit3 size={18} />
                  </button>
                </div>
              ) : (
                <div className="pt-2">
                   <button
                    onClick={() => navigate('/profile')}
                    className="group px-6 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 hover:bg-amber-500/20 transition-all"
                   >
                     <AlertCircle size={16} />
                     <span>Authorize Settlement Bank Account</span>
                     <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                   </button>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-row lg:flex-col items-center justify-center gap-4 shrink-0 w-full lg:w-auto">
             <button
               onClick={() => setIsFundModalOpen(true)}
               className="flex-1 lg:w-full px-8 py-5 rounded-2xl bg-emerald-400 hover:bg-emerald-300 text-black text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-[0_10px_30px_rgba(52,211,153,0.2)] flex items-center justify-center gap-3 group"
             >
               <Zap size={20} className="fill-current animate-pulse" />
               <span>Deposit Funds</span>
             </button>
             
             <button
               onClick={() => {
                 if (currentUser.balance <= 0) {
                   alert('Negative liquidity detected. Deposit funds to enable withdrawal.');
                   return;
                 }
                 setIsCashOutModalOpen(true);
               }}
               disabled={currentUser.balance <= 0}
               className="flex-1 lg:w-full px-8 py-5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border border-neutral-700 shadow-xl flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale group"
             >
               <ArrowUpRight size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
               <span>Withdraw</span>
             </button>
          </div>
        </div>
      </div>

      {/* 2. TRANSACTION LEDGER SECTION */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-8 sm:p-10 border-b border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-b from-black/20 to-transparent">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <HistoryIcon size={20} className="text-emerald-400" />
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Combat Ledger</h3>
            </div>
            <p className="text-neutral-500 text-xs font-medium">Encrypted log of all financial deployments and earnings.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
             {onCleanHistory && (
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => handleClean(false)}
                   disabled={isCleaning}
                   className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                 >
                   <RefreshCw size={14} className={isCleaning ? 'animate-spin text-amber-400' : ''} />
                   <span>Sync Logs</span>
                 </button>
                 <button
                   onClick={() => handleClean(true)}
                   disabled={isCleaning}
                   className="px-5 py-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-[10px] font-black uppercase tracking-widest text-rose-500 transition-all flex items-center gap-2 disabled:opacity-50"
                 >
                   <Trash2 size={14} />
                   <span>Purge</span>
                 </button>
               </div>
             )}
          </div>
        </div>

        {cleanStatus && (
          <div className="mx-10 mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-in slide-in-from-top-2">
            <CheckCircle2 size={18} />
            {cleanStatus}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="px-10 py-6 border-b border-neutral-800/50 flex flex-wrap items-center gap-2">
          {[
            { id: 'ALL', label: 'ALL LOGS', count: currentUser.transactions.length },
            { id: 'PAYOUTS', label: 'WITHDRAWALS', icon: ArrowUpRight },
            { id: 'DEPOSITS', label: 'DEPOSITS', icon: ArrowDownLeft },
            { id: 'WINNINGS', label: 'EARNINGS', icon: Trophy },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border flex items-center gap-2 ${
                filter === tab.id
                  ? 'bg-emerald-400 border-emerald-400 text-black shadow-lg shadow-emerald-400/10 scale-105'
                  : 'bg-neutral-950 border-neutral-800 text-neutral-500 hover:text-white hover:border-neutral-700'
              }`}
            >
              {tab.icon && <tab.icon size={12} />}
              <span>{tab.label}</span>
              {tab.count !== undefined && <span className={`ml-1 font-mono ${filter === tab.id ? 'text-black/60' : 'text-neutral-700'}`}>[{tab.count}]</span>}
            </button>
          ))}
        </div>

        {/* Transaction Table / List */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] border-b border-neutral-800 bg-black/20">
                <th className="px-10 py-5">Combat Incident</th>
                <th className="px-10 py-5">Protocol Status</th>
                <th className="px-10 py-5 text-right">Delta Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/50">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-10 py-20 text-center">
                     <div className="flex flex-col items-center gap-6 opacity-20 group">
                        <HistoryIcon size={80} className="text-neutral-500 group-hover:rotate-12 transition-transform duration-700" />
                        <div className="space-y-1">
                          <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">Ledger Zero</p>
                          <p className="text-[10px] font-medium text-neutral-600 uppercase">No incidents recorded under this protocol.</p>
                        </div>
                     </div>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => {
                  const badge = getStatusBadge(tx);
                  const isDebit = tx.type === 'WITHDRAWAL' || tx.type === 'ESCROW_LOCK';
                  
                  return (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-all duration-300 group">
                      <td className="px-10 py-8">
                         <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 ${
                              tx.type === 'WITHDRAWAL' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 group-hover:bg-rose-500/20' :
                              tx.type === 'DEPOSIT' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400 group-hover:bg-blue-500/20' :
                              tx.type === 'MATCH_WIN_PAYOUT' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500/20' :
                              'bg-neutral-800 border-neutral-700 text-neutral-400'
                            }`}>
                               {tx.type === 'WITHDRAWAL' ? <ArrowUpRight size={22} /> :
                                tx.type === 'DEPOSIT' ? <ArrowDownLeft size={22} /> :
                                tx.type === 'MATCH_WIN_PAYOUT' ? <Trophy size={22} /> :
                                <Zap size={22} />}
                            </div>
                            <div className="space-y-1">
                               <p className="text-[13px] font-black text-white uppercase tracking-tight leading-none">{tx.description}</p>
                               <p className="text-[10px] text-neutral-600 font-mono tracking-tighter uppercase">{new Date(tx.timestamp).toLocaleString()} · ID: {tx.id.slice(-8)}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-10 py-8">
                         <div className={`px-4 py-1.5 rounded-full text-[9px] font-black border tracking-[0.1em] flex items-center gap-2 w-fit ${badge.color}`}>
                           <badge.icon size={12} />
                           {badge.label}
                         </div>
                      </td>
                      <td className="px-10 py-8 text-right">
                         <div className={`text-xl font-black font-mono tracking-tighter group-hover:scale-105 transition-transform origin-right ${isDebit ? 'text-rose-400' : 'text-emerald-400'}`}>
                           {isDebit ? '-' : '+'}₦{tx.amount.toLocaleString()}
                         </div>
                         <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em] mt-1">NGN Settlement</p>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Security Footer Notice */}
      <div className="flex items-center justify-center gap-8 py-8 opacity-40">
         <div className="flex items-center gap-3 text-neutral-500">
           <Shield size={20} />
           <span className="text-[10px] font-black uppercase tracking-[0.2em]">End-to-End Escrow Protection</span>
         </div>
         <div className="flex items-center gap-3 text-neutral-500">
           <Landmark size={20} />
           <span className="text-[10px] font-black uppercase tracking-[0.2em]">NUBAN Settlement Standards</span>
         </div>
         <div className="flex items-center gap-3 text-neutral-500">
           <CreditCard size={20} />
           <span className="text-[10px] font-black uppercase tracking-[0.2em]">Secure Gateway Protocol</span>
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

