import React, { useState, useEffect } from 'react';
import { UserProfile, Match } from '../types';
import {
  User, Trophy, Award, TrendingUp, ShieldCheck, Swords,
  Edit3, Check, Copy, ArrowRight, Shield, Zap, Flame, Clock,
  Calendar, CheckCircle2, AlertCircle, Camera, Crosshair, Users, LogOut, BookOpen,
  Volume2, VolumeX, Building, CreditCard, Lock, Loader2, Save, RefreshCw, Send, Bell, MessageSquare, Settings
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { useSoundSettings, playShotgunSound } from '../hooks/useSound';
import { SUPPORTED_BANKS } from './CashOutModal';

interface ProfilePageProps {
  currentUser: UserProfile;
  matches: Match[];
  onUpdateUser?: (updatedData: Partial<UserProfile>) => Promise<void>;
  onNavigateToArena?: () => void;
  onCashOut?: (
    amount: number,
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountName: string;
      gateway?: 'flutterwave' | 'paystack';
    }
  ) => Promise<void>;
  onNavigateToHistory: () => void;
  onNavigateToRules: () => void;
  onOpenCreateBet: (mode?: string, stake?: number) => void;
  onSignOut?: () => void;
  onNavigateToReferrals: () => void;
}

const AVATAR_OPTIONS = [
  'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=300&q=80',
  'https://images.unsplash.com/photo-1628157582853-a796fa650a6a?auto=format&fit=crop&w=300&q=80',
];

export const ProfilePage: React.FC<ProfilePageProps> = ({
  currentUser,
  matches,
  onUpdateUser,
  onCashOut,
  onNavigateToArena,
  onNavigateToHistory,
  onNavigateToRules,
  onOpenCreateBet,
  onSignOut,
  onNavigateToReferrals,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editIgn, setEditIgn] = useState(currentUser.codmIgn);
  const [editUid, setEditUid] = useState(currentUser.codmUid);
  const [editEmail, setEditEmail] = useState(currentUser.email);
  const [editPhone, setEditPhone] = useState(currentUser.phone);
  const [editBankName, setEditBankName] = useState(currentUser.bankName || '');
  const [editAccountNumber, setEditAccountNumber] = useState(currentUser.accountNumber || '');
  const [editAccountName, setEditAccountName] = useState(currentUser.accountName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar);
  const [copiedUid, setCopiedUid] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { soundEnabled, toggleSound } = useSoundSettings();
  const [soundTestPlayed, setSoundTestPlayed] = useState(false);

  // Dedicated Permanent Bank Details State
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankName, setBankName] = useState(currentUser.bankName || 'OPay Digital Bank');
  const [accountNumber, setAccountNumber] = useState(currentUser.accountNumber || '');
  const [accountName, setAccountName] = useState(currentUser.accountName || '');
  const [isResolvingNuban, setIsResolvingNuban] = useState(false);
  const [nubanError, setNubanError] = useState<string | null>(null);
  const [nubanResolved, setNubanResolved] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [bankSaveSuccess, setBankSaveSuccess] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Telegram Bot Alert State
  const [telegramChatId, setTelegramChatId] = useState(currentUser.telegramChatId || '');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  useEffect(() => {
    if (currentUser.bankName) setBankName(currentUser.bankName);
    if (currentUser.accountNumber) setAccountNumber(currentUser.accountNumber);
    if (currentUser.accountName) setAccountName(currentUser.accountName);
    if (currentUser.bankName) setEditBankName(currentUser.bankName);
    if (currentUser.accountNumber) setEditAccountNumber(currentUser.accountNumber);
    if (currentUser.accountName) setEditAccountName(currentUser.accountName);
    if (currentUser.telegramChatId) setTelegramChatId(currentUser.telegramChatId);
  }, [currentUser.bankName, currentUser.accountNumber, currentUser.accountName, currentUser.telegramChatId]);

  const handleSaveTelegramId = async () => {
    setIsSavingTelegram(true);
    setTelegramFeedback(null);
    try {
      if (onUpdateUser) {
        await onUpdateUser({
          telegramChatId: telegramChatId.trim(),
        });
      }
      setTelegramFeedback({ type: 'success', msg: 'Telegram Chat ID saved permanently!' });
      setTimeout(() => setTelegramFeedback(null), 4000);
    } catch (err: any) {
      setTelegramFeedback({ type: 'error', msg: err.message || 'Failed to save Telegram Chat ID' });
    } finally {
      setIsSavingTelegram(false);
    }
  };

  const handleSendTestAlert = async () => {
    if (!telegramChatId || !telegramChatId.trim()) {
      setTelegramFeedback({ type: 'error', msg: 'Please enter a Telegram Chat ID first.' });
      return;
    }
    setIsSendingTestAlert(true);
    setTelegramFeedback(null);
    try {
      const res = await fetch('/api/telegram/test-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: telegramChatId.trim(),
          userId: currentUser.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramFeedback({ type: 'success', msg: data.message || 'Test alert sent! Check your Telegram app.' });
      } else {
        setTelegramFeedback({ type: 'error', msg: data.error || 'Failed to send test alert. Make sure you started the bot on Telegram.' });
      }
    } catch (err: any) {
      setTelegramFeedback({ type: 'error', msg: 'Network error sending test alert.' });
    } finally {
      setIsSendingTestAlert(false);
    }
  };

  const resolveBankDetails = async (accNum: string, bank: string) => {
    if (accNum.length !== 10) return;
    setIsResolvingNuban(true);
    setNubanError(null);
    setNubanResolved(false);

    try {
      const res = await fetch(`/api/resolve-account?account_number=${encodeURIComponent(accNum)}&bank_name=${encodeURIComponent(bank)}`);
      const data = await res.json();
      if (data.status && data.data?.account_name) {
        setAccountName(data.data.account_name);
        setNubanResolved(true);
        setNubanError(null);
      } else {
        setNubanResolved(false);
        setNubanError(data.error || data.message || `Could not verify account name with ${bank}.`);
      }
    } catch (err: any) {
      setNubanResolved(false);
      setNubanError('Network error checking bank account. Please verify internet connection.');
    } finally {
      setIsResolvingNuban(false);
    }
  };

  const handleAccountNumberChange = (val: string) => {
    const clean = val.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(clean);
    setNubanResolved(false);
    setNubanError(null);
    if (clean.length === 10) {
      resolveBankDetails(clean, bankName);
    }
  };

  const handleBankChange = (newBank: string) => {
    setBankName(newBank);
    setNubanResolved(false);
    setNubanError(null);
    if (accountNumber.length === 10) {
      resolveBankDetails(accountNumber, newBank);
    }
  };

  const handleSavePermanentBank = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!bankName) {
      setNubanError('Please select a bank name');
      return;
    }
    if (!accountNumber || accountNumber.trim().length !== 10) {
      setNubanError('Please enter a valid 10-digit Nigerian account number');
      return;
    }
    if (!accountName || !accountName.trim()) {
      setNubanError('Please verify or enter the account holder name');
      return;
    }

    setIsSavingBank(true);
    setNubanError(null);
    try {
      if (onUpdateUser) {
        await onUpdateUser({
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          accountName: accountName.trim(),
        });
      }
      setIsEditingBank(false);
      setBankSaveSuccess(true);
      setTimeout(() => setBankSaveSuccess(false), 3500);
    } catch (err: any) {
      setNubanError(err.message || 'Failed to save bank details to database');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleCopyBank = () => {
    if (!currentUser.accountNumber) return;
    navigator.clipboard.writeText(currentUser.accountNumber);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const winRate =
    currentUser.wins + currentUser.losses > 0
      ? Math.round((currentUser.wins / (currentUser.wins + currentUser.losses)) * 100)
      : 0;

  const handleCopyUid = () => {
    navigator.clipboard.writeText(currentUser.codmUid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      await onUpdateUser({
        codmIgn: editIgn.trim() || currentUser.codmIgn,
        codmUid: editUid.trim() || currentUser.codmUid,
        email: editEmail.trim() || currentUser.email,
        phone: editPhone.trim() || currentUser.phone,
        bankName: editBankName.trim() || undefined,
        accountNumber: editAccountNumber.trim() || undefined,
        accountName: editAccountName.trim() || undefined,
        avatar: selectedAvatar,
      });
    }
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-6 duration-700">
      {/* 1. TACTICAL CALLING CARD IDENTITY */}
      <div className="relative overflow-hidden rounded-[3rem] bg-neutral-900 border-2 border-amber-500/40 p-8 sm:p-12 shadow-[0_0_50px_rgba(0,0,0,0.5)] group">
        {/* Ambient tactical backgrounds */}
        <div className="absolute inset-0 z-0 opacity-20 group-hover:opacity-30 transition-opacity duration-700">
          <img src={CODM_IMAGES.cardBgSubtle} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-black/90" />
        </div>
        
        {/* Animated corner glows */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-amber-500/15 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] animate-pulse" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-10">
          {/* Player Identity Block */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8">
            <div className="relative shrink-0">
              <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-[2.5rem] overflow-hidden border-4 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.2)] bg-neutral-800">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.codmIgn}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).src = AVATAR_OPTIONS[0]; }}
                />
              </div>
              <div className="absolute -bottom-3 -right-3 px-5 py-2 rounded-2xl bg-black border-2 border-amber-400 text-[11px] font-black font-mono text-amber-400 shadow-xl tracking-tighter">
                LVL 150
              </div>
            </div>

            <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4">
                  <h1 className="font-heading font-black text-4xl sm:text-6xl text-white tracking-tighter uppercase leading-none">
                    {currentUser.codmIgn}
                  </h1>
                  <div className="px-5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-[10px] font-black tracking-[0.2em] flex items-center gap-2 shadow-inner">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    LEGENDARY TIER
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/60 border border-neutral-800 text-xs font-mono group/uid">
                    <span className="text-neutral-500 uppercase tracking-tighter font-black">SECTOR ID:</span>
                    <span className="text-neutral-200 font-bold tracking-widest">{currentUser.codmUid}</span>
                    <button onClick={handleCopyUid} className="ml-1 text-neutral-600 hover:text-amber-400 transition-colors p-1 cursor-pointer">
                      {copiedUid ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-black/60 border border-neutral-800 text-xs font-mono">
                    <span className="text-neutral-500 uppercase tracking-tighter font-black">CLAN:</span>
                    <span className="text-amber-400 font-black tracking-widest">[1V1_PRO]</span>
                  </div>
                </div>
              </div>

              {/* Combat Summary stats row */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-6 pt-2">
                 <div className="space-y-1">
                   <p className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.3em]">Victory Record</p>
                   <div className="flex items-center gap-3">
                     <span className="text-3xl font-black text-emerald-400 font-mono">{currentUser.wins}W</span>
                     <div className="h-6 w-px bg-neutral-800" />
                     <span className="text-3xl font-black text-rose-500 font-mono">{currentUser.losses}L</span>
                   </div>
                 </div>
                 <div className="h-12 w-px bg-neutral-800 hidden sm:block" />
                 <div className="space-y-1">
                   <p className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.3em]">Combat Earnings</p>
                   <div className="text-3xl font-black text-white font-mono tracking-tighter flex items-baseline gap-1.5">
                     <span className="text-amber-400 text-xl">₦</span>{currentUser.totalWinnings.toLocaleString()}
                   </div>
                 </div>
              </div>
            </div>
          </div>

          {/* Action Buttons Column */}
          <div className="flex flex-row lg:flex-col items-center justify-center gap-5 shrink-0">
             <button
               onClick={() => setIsEditing(!isEditing)}
               className="w-full sm:w-auto px-8 py-5 rounded-[1.75rem] bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border border-neutral-700 shadow-xl flex items-center justify-center gap-3 group"
             >
               <Settings size={20} className="text-neutral-500 group-hover:text-amber-400 group-hover:rotate-45 transition-all" />
               <span>Settings</span>
             </button>
             
             <button
               onClick={() => onOpenCreateBet('1v1 Sniper Only', 1000)}
               className="w-full sm:w-auto px-10 py-5 rounded-[1.75rem] bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-[0_15px_40px_rgba(251,191,36,0.15)] flex items-center justify-center gap-3 group"
             >
               <Swords size={20} className="group-hover:scale-110 transition-transform" />
               <span>Deploy Duel</span>
             </button>
          </div>
        </div>

        {/* Level Progression Bar */}
        <div className="mt-12 relative z-10 space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <Shield size={16} className="text-amber-400" />
              <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Global Rank Progression</span>
            </div>
            <div className="flex items-center gap-4">
               <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">TOP 1% ACTIVE</span>
               <div className="h-1 w-8 bg-neutral-800 rounded-full" />
               <span className="text-[11px] font-black text-amber-400 uppercase tracking-widest">SEASON 09</span>
            </div>
          </div>
          <div className="h-4 w-full bg-black/60 rounded-full border border-neutral-800/50 overflow-hidden p-1 shadow-inner">
            <div className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200 rounded-full shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-shimmer" style={{ width: '85%' }} />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. STATS GRID & QUICK NAVIGATION                              */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* NAV CARDS */}
        {[
          { label: 'Battle Arena', sub: 'Jump into active duels', icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/5', border: 'border-amber-500/20', action: onNavigateToArena },
          { label: 'Winnings History', sub: 'Verified prize payouts', icon: Trophy, color: 'text-emerald-400', bg: 'bg-emerald-400/5', border: 'border-emerald-500/20', action: onNavigateToHistory },
          { label: 'Referral HQ', sub: 'Earn ₦1,000 per referral', icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/5', border: 'border-blue-500/20', action: onNavigateToReferrals },
        ].map((item, idx) => (
          <button
            key={idx}
            onClick={item.action}
            className={`p-8 rounded-[2rem] bg-neutral-900 border ${item.border} hover:border-white/20 transition-all duration-500 text-left group shadow-xl relative overflow-hidden`}
          >
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all group-hover:scale-110 duration-700 ${item.color}`}><item.icon size={80} /></div>
            <div className={`w-14 h-14 rounded-2xl ${item.bg} border ${item.border} flex items-center justify-center ${item.color} mb-6 transition-transform group-hover:scale-110 group-hover:rotate-6`}>
              <item.icon size={28} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter leading-none mb-2">{item.label}</h3>
            <p className="text-xs text-neutral-500 font-medium">{item.sub}</p>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SETTINGS & INFRASTRUCTURE FORMS (DRAWER STYLE)            */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* PERMANENT BANK SECTION */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-emerald-400 pointer-events-none group-hover:opacity-5 transition-opacity duration-700">
            <Building size={160} />
          </div>
          
          <div className="flex justify-between items-start border-b border-neutral-800/50 pb-6 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Building size={18} className="text-emerald-400" />
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Treasury Link</h3>
              </div>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">Official NUBAN account for Prize disbursements.</p>
            </div>
            <button
              onClick={() => setIsEditingBank(!isEditingBank)}
              className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-[10px] font-black uppercase tracking-widest border border-neutral-700 transition-all active:scale-95"
            >
              {isEditingBank ? 'Cancel' : 'Modify'}
            </button>
          </div>

          <div className="relative z-10">
            {!isEditingBank ? (
              currentUser.bankName ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-6 bg-black/40 rounded-2xl border border-neutral-800 space-y-4">
                       <div className="flex justify-between items-start">
                         <div className="space-y-1">
                            <p className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.2em]">Settlement Bank</p>
                            <p className="text-lg font-black text-white">{currentUser.bankName}</p>
                         </div>
                         <div className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-500 uppercase tracking-widest">Active Link</div>
                       </div>
                       
                       <div className="flex justify-between items-end">
                         <div className="space-y-1">
                            <p className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.2em]">NUBAN Account</p>
                            <p className="text-2xl font-black text-amber-400 font-mono tracking-tighter">{currentUser.accountNumber}</p>
                         </div>
                         <button onClick={handleCopyBank} className="p-3 bg-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-colors cursor-pointer">
                           {copiedBank ? <Check size={18} /> : <Copy size={18} />}
                         </button>
                       </div>

                       <div className="pt-4 border-t border-neutral-800/50 flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500"><ShieldCheck size={16} /></div>
                         <div className="space-y-0.5">
                            <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em]">Verified Beneficiary</p>
                            <p className="text-xs font-black text-emerald-300 uppercase tracking-tight">{currentUser.accountName || currentUser.codmIgn}</p>
                         </div>
                       </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-10 text-center space-y-6 bg-black/20 rounded-3xl border border-dashed border-neutral-800">
                  <div className="w-16 h-16 rounded-[1.5rem] bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-500/40 mx-auto">
                    <Building size={32} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-white font-black uppercase tracking-tighter">No Treasury Linked</h4>
                    <p className="text-xs text-neutral-500 max-w-[200px] mx-auto">Link your NUBAN account to enable automated match payouts.</p>
                  </div>
                  <button onClick={() => setIsEditingBank(true)} className="px-8 py-3 bg-amber-400 text-black font-black text-[11px] uppercase tracking-widest rounded-2xl shadow-xl shadow-amber-400/10">Authorize Link</button>
                </div>
              )
            ) : (
              <form onSubmit={handleSavePermanentBank} className="space-y-6 animate-in fade-in duration-300">
                 <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-2">Provider</label>
                      <select
                        value={bankName}
                        onChange={(e) => handleBankChange(e.target.value)}
                        className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-sm font-bold text-white focus:border-emerald-400 focus:outline-none transition-all cursor-pointer"
                      >
                        {SUPPORTED_BANKS.map((b) => (
                          <option key={b.name} value={b.name} className="bg-neutral-900">{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-2">NUBAN Code</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={accountNumber}
                        onChange={(e) => handleAccountNumberChange(e.target.value)}
                        placeholder="0123456789"
                        className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-lg font-mono font-black text-amber-400 focus:border-emerald-400 focus:outline-none transition-all placeholder:text-neutral-900"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between ml-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Verified Name</label>
                        {isResolvingNuban && <span className="text-[9px] font-black text-amber-400 animate-pulse uppercase">Verifying Ledger...</span>}
                      </div>
                      <input
                        type="text"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="LEGAL FULL NAME"
                        className={`w-full bg-black border rounded-2xl px-5 py-4 text-xs font-black uppercase tracking-tight transition-all focus:outline-none ${nubanResolved ? 'border-emerald-500 text-emerald-400' : 'border-neutral-800 text-white'}`}
                      />
                    </div>
                 </div>

                 <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button type="submit" disabled={isSavingBank || isResolvingNuban} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase text-[11px] tracking-widest py-5 rounded-[1.5rem] shadow-xl shadow-emerald-500/10 transition-all flex items-center justify-center gap-3 disabled:opacity-30">
                      {isSavingBank ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      Authorize Link
                    </button>
                 </div>
                 {nubanError && <p className="text-[10px] font-black text-rose-500 uppercase text-center">{nubanError}</p>}
              </form>
            )}
          </div>
        </section>

        {/* TELEGRAM INFRASTRUCTURE SECTION */}
        <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-sky-400 pointer-events-none group-hover:opacity-5 transition-opacity duration-700">
            <Send size={160} />
          </div>

          <div className="flex justify-between items-start border-b border-neutral-800/50 pb-6 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Send size={18} className="text-sky-400" />
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Bot Comms</h3>
              </div>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed">Encrypted real-time match synchronization.</p>
            </div>
            <div className="px-3 py-1 rounded bg-sky-500/10 border border-sky-500/20 text-[9px] font-black text-sky-500 uppercase tracking-widest">AES-256 Active</div>
          </div>

          <div className="space-y-6 relative z-10">
             <div className="p-6 bg-black/40 rounded-2xl border border-neutral-800 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shrink-0"><Bell size={20} /></div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-black text-white uppercase tracking-tight">Sync Protocol</p>
                    <p className="text-[10px] text-neutral-500 leading-relaxed">Authorize your Telegram ID to receive instant battle-room deployments and prize confirmation alerts.</p>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-neutral-800/50">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.2em] ml-2">Handshake Chat ID</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        placeholder="e.g. 987654321"
                        className="flex-1 bg-black/80 border border-neutral-800 rounded-2xl px-5 py-4 text-sm font-mono font-bold text-sky-400 focus:border-sky-400 focus:outline-none transition-all"
                      />
                      <button onClick={handleSaveTelegramId} disabled={isSavingTelegram} className="px-6 bg-sky-500 text-black font-black uppercase text-[10px] tracking-widest rounded-2xl hover:bg-sky-400 transition-all disabled:opacity-30">
                        {isSavingTelegram ? <Loader2 size={16} className="animate-spin" /> : 'SAVE'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button onClick={() => window.open('https://t.me/userinfobot', '_blank')} className="px-4 py-3 bg-neutral-800 rounded-xl text-[10px] font-black text-neutral-400 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-neutral-700 transition-all">
                      <User size={14} /> Get ID
                    </button>
                    <button onClick={handleSendTestAlert} disabled={isSendingTestAlert || !telegramChatId} className="px-4 py-3 bg-neutral-800 border border-sky-500/20 rounded-xl text-[10px] font-black text-sky-400 uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-sky-500/10 transition-all disabled:opacity-30">
                      {isSendingTestAlert ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Ping Test
                    </button>
                  </div>
                </div>
             </div>
             
             {telegramFeedback && (
               <div className={`p-4 rounded-xl border text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2 ${telegramFeedback.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                 {telegramFeedback.msg}
               </div>
             )}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. TACTICAL SETTINGS & AUDIO (DRAWER STYLE)                    */}
      {/* ------------------------------------------------------------- */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
        <div className="flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-8">
            <div className={`w-24 h-24 rounded-[2rem] flex items-center justify-center border-2 transition-all duration-700 ${soundEnabled ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-[0_0_50px_rgba(251,191,36,0.15)] scale-110' : 'bg-neutral-950 border-neutral-800 text-neutral-600 shadow-none'}`}>
               {soundEnabled ? <Volume2 size={48} className="animate-pulse" /> : <VolumeX size={48} />}
            </div>
            <div className="space-y-2">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Acoustic Feedback</h3>
               <p className="text-sm text-neutral-500 max-w-md">Authentic 12-gauge shotgun blast effects for UI interactions and combat deployments.</p>
               <div className="flex items-center gap-3 pt-2">
                 <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${soundEnabled ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-neutral-950 border-neutral-800 text-neutral-700'}`}>
                   Status: {soundEnabled ? 'ENABLED' : 'MUTED'}
                 </div>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button
               onClick={() => { playShotgunSound(); setSoundTestPlayed(true); setTimeout(() => setSoundTestPlayed(false), 1000); }}
               disabled={!soundEnabled}
               className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all ${soundEnabled ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 active:scale-90' : 'bg-neutral-950 border-neutral-900 text-neutral-800 opacity-30 cursor-not-allowed'}`}
             >
               <Crosshair size={32} className={soundTestPlayed ? 'animate-spin' : ''} />
             </button>

             <button
               onClick={toggleSound}
               className={`relative h-16 w-32 rounded-full border-4 transition-all duration-500 ${soundEnabled ? 'bg-amber-400 border-amber-200' : 'bg-neutral-950 border-neutral-800'}`}
             >
               <div className={`absolute top-1.5 w-10 h-10 rounded-full transition-all duration-500 shadow-xl ${soundEnabled ? 'right-2 bg-white' : 'left-2 bg-neutral-700'}`} />
               <div className="absolute inset-0 flex items-center justify-between px-4 pointer-events-none">
                 <span className={`text-[10px] font-black transition-opacity ${soundEnabled ? 'opacity-0' : 'opacity-100'}`}>OFF</span>
                 <span className={`text-[10px] font-black text-black transition-opacity ${soundEnabled ? 'opacity-100' : 'opacity-0'}`}>ON</span>
               </div>
             </button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. EDIT FORM OVERLAY (WHEN ACTIVE)                            */}
      {/* ------------------------------------------------------------- */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-500">
           <div className="w-full max-w-3xl bg-neutral-900 border-2 border-amber-500/30 rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden relative">
              <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
              
              <div className="p-10 sm:p-12 space-y-10 max-h-[90vh] overflow-y-auto custom-scrollbar">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Profile Terminal</h3>
                    <p className="text-neutral-500 text-sm font-medium">Update your combat credentials and identity.</p>
                  </div>
                  <button onClick={() => setIsEditing(false)} className="w-12 h-12 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all flex items-center justify-center active:scale-90"><X size={24} /></button>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-10">
                   {/* Avatar Terminal */}
                   <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Camera size={14} className="text-amber-400" />
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em]">Biometric Identity</label>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        {AVATAR_OPTIONS.map((av, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setSelectedAvatar(av)}
                            className={`relative w-20 h-20 rounded-2xl overflow-hidden border-4 transition-all duration-300 ${selectedAvatar === av ? 'border-amber-400 scale-110 shadow-2xl shadow-amber-400/20' : 'border-neutral-800 opacity-40 hover:opacity-100 hover:border-neutral-700'}`}
                          >
                            <img src={av} alt="" className="w-full h-full object-cover" />
                            {selectedAvatar === av && <div className="absolute inset-0 bg-amber-400/10 flex items-center justify-center"><CheckCircle2 className="text-amber-400" size={24} /></div>}
                          </button>
                        ))}
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-2">Gamer Tag (IGN)</label>
                        <input type="text" value={editIgn} onChange={e => setEditIgn(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-[1.25rem] px-6 py-5 text-lg font-black text-white focus:border-amber-400 focus:outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-2">Terminal ID (UID)</label>
                        <input type="text" value={editUid} onChange={e => setEditUid(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-[1.25rem] px-6 py-5 text-lg font-mono font-black text-neutral-400 focus:border-amber-400 focus:outline-none transition-all" />
                      </div>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-2">Comms Email</label>
                        <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-[1.25rem] px-6 py-5 text-sm font-bold text-white focus:border-amber-400 focus:outline-none transition-all" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-2">Deployment Alert Phone</label>
                        <input type="text" value={editPhone} onChange={e => setEditPhone(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-[1.25rem] px-6 py-5 text-lg font-mono font-black text-neutral-400 focus:border-amber-400 focus:outline-none transition-all" />
                      </div>
                   </div>

                   <div className="flex gap-4 pt-6">
                      <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-white font-black uppercase text-xs tracking-[0.2em] py-5 rounded-[1.5rem] transition-all">Abort</button>
                      <button type="submit" className="flex-[2] bg-amber-400 hover:bg-amber-300 text-black font-black uppercase text-xs tracking-[0.2em] py-5 rounded-[1.5rem] shadow-xl shadow-amber-400/10 transition-all flex items-center justify-center gap-3">
                        <Check size={20} />
                        Sync Data
                      </button>
                   </div>
                </form>
              </div>
           </div>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] bg-emerald-500 text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-10">
          <CheckCircle2 size={20} />
          Terminal Data Synced Successfully
        </div>
      )}
    </div>
  );
};

const X = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);
