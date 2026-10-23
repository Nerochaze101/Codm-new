import React, { useState, useEffect } from 'react';
import { UserProfile, Match } from '../types';
import {
  User, Trophy, Award, TrendingUp, ShieldCheck, Swords,
  Edit3, Check, Copy, ArrowRight, Shield, Zap, Flame, Clock,
  Calendar, CheckCircle2, AlertCircle, Camera, Crosshair, Users, LogOut, BookOpen,
  Volume2, VolumeX, Building, CreditCard, Lock, Loader2, Save, RefreshCw, Send, Bell, MessageSquare
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

  const userMatches = matches.filter(
    (m) => m.creator.id === currentUser.id || m.opponent?.id === currentUser.id
  );

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
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* ------------------------------------------------------------- */}
      {/* 1. OFFICIAL CALLING CARD & TIER BADGE                         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-3xl bg-neutral-900/90 border-2 border-amber-500/40 p-6 sm:p-8 shadow-2xl">
        {/* Ambient tactical glows */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            {/* Calling Card Player Identity */}
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.codmIgn}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover bg-neutral-800 border-2 border-amber-400 shadow-2xl"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = AVATAR_OPTIONS[0];
                  }}
                />
                <span className="absolute -bottom-2 -right-1 px-2.5 py-0.5 rounded-md bg-neutral-950 border border-amber-400 text-xs font-mono-nums font-black text-amber-400 shadow">
                  LVL 150
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="font-heading font-black text-2xl sm:text-4xl text-white tracking-wide uppercase">
                    {currentUser.codmIgn}
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 font-mono text-xs font-black tracking-wider flex items-center gap-1.5 shadow">
                    <Award className="w-3.5 h-3.5" />
                    LEGENDARY TIER
                  </span>
                </div>

                <div className="text-xs sm:text-sm text-neutral-400 font-mono-nums flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span>UID: <strong className="text-neutral-200">{currentUser.codmUid}</strong></span>
                    <button
                      onClick={handleCopyUid}
                      className="text-neutral-400 hover:text-amber-400 transition-colors p-0.5 cursor-pointer"
                      title="Copy UID"
                    >
                      {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span>·</span>
                  <span className="text-amber-400 font-bold font-mono">CLAN: [1V1_PRO]</span>
                </div>

                {/* Combat Stats Line */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold font-mono-nums">
                    <Trophy className="w-4 h-4" />
                    <span>{currentUser.wins}W - {currentUser.losses}L ({winRate}% Win Rate)</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold font-mono-nums">
                    <TrendingUp className="w-4 h-4" />
                    <span>Escrow Winnings: ₦{currentUser.totalWinnings.toLocaleString()}</span>
                  </div>
                </div>

                {/* Referrals section removed, now on dedicated page */}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap md:flex-col gap-2.5">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Gamer Tag Info'}</span>
              </button>

              <button
                onClick={() => onOpenCreateBet('1v1 Sniper Only', 100)}
                className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide shadow-md"
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Create 1v1 Bet</span>
              </button>

              {onSignOut && (
                <button
                  onClick={onSignOut}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          </div>

          {/* Level 150 Battle Pass & Ranked Progress Bar */}
          <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400 font-bold">LEGENDARY RANK PROGRESSION (8,420 XP)</span>
              <span className="text-amber-400 font-black">TOP 1% NIGERIAN PLAYERS</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
              <div className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full w-[85%]" />
            </div>
          </div>
        </div>
      </div>



      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Profile information successfully updated!</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. PERMANENT PAYOUT BANK DETAILS (SAVED IN DATABASE)          */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-3xl bg-neutral-900 border-2 border-emerald-500/40 p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-emerald-400 pointer-events-none">
          <Building className="w-32 h-32" />
        </div>

        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black font-heading text-white uppercase tracking-wide">
                  Permanent Payout Bank Account
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Database Synced
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Official Nigerian bank account for automated 1v1 match winnings, prize disbursements, and instant withdrawals. Stored permanently until you change it.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsEditingBank(!isEditingBank);
              setNubanError(null);
            }}
            className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 self-start sm:self-auto shrink-0 border border-neutral-700"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>{isEditingBank ? 'Cancel' : currentUser.bankName && currentUser.accountNumber ? 'Change Bank Details' : 'Link Bank Account'}</span>
          </button>
        </div>

        {bankSaveSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Bank details saved permanently to your profile and database!</span>
          </div>
        )}

        {/* Display Current Saved Bank Details */}
        {!isEditingBank && (
          <div>
            {currentUser.bankName && currentUser.accountNumber ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Bank Name
                  </span>
                  <div className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{currentUser.bankName}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono">Supported Nigerian Bank</span>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                      Account Number (NUBAN)
                    </span>
                    <button
                      onClick={handleCopyBank}
                      className="text-neutral-400 hover:text-amber-400 transition-colors p-0.5 cursor-pointer flex items-center gap-1 text-[10px]"
                      title="Copy Account Number"
                    >
                      {copiedBank ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span className="font-mono">{copiedBank ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="text-base sm:text-lg font-black font-mono-nums text-amber-400 tracking-wider">
                    {currentUser.accountNumber}
                  </div>
                  <span className="text-[10px] text-neutral-500 font-mono">10-Digit Direct Deposit NUBAN</span>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                  <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider block">
                    Verified Account Holder Name
                  </span>
                  <div className="text-sm sm:text-base font-bold text-emerald-300 flex items-center gap-1.5 truncate">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">{currentUser.accountName || currentUser.codmIgn}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80 font-mono">✓ Verified Account Holder</span>
                </div>
              </div>
            ) : (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-amber-300 uppercase tracking-wider font-mono">
                      No Payout Bank Details Linked
                    </div>
                    <p className="text-xs text-neutral-400">
                      Link your permanent Nigerian bank account so that 1v1 match winnings and wallet cashouts are processed automatically to you.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditingBank(true)}
                  className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shadow-md"
                >
                  Link Bank Account
                </button>
              </div>
            )}
          </div>
        )}

        {/* Change Bank Details Interactive Form */}
        {isEditingBank && (
          <form onSubmit={handleSavePermanentBank} className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <span className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
                <Building className="w-4 h-4 text-amber-400" />
                <span>Update Permanent Bank Details</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">Updates Saved Permanently In DB</span>
            </div>

            {nubanError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{nubanError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Bank Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
                  Select Bank
                </label>
                <select
                  value={bankName}
                  onChange={(e) => handleBankChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white font-semibold text-xs focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  {SUPPORTED_BANKS.map((b) => (
                    <option key={b.name} value={b.name} className="bg-neutral-900 text-white">
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 10-digit Account Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
                  10-Digit Account Number (NUBAN)
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={accountNumber}
                  onChange={(e) => handleAccountNumberChange(e.target.value)}
                  placeholder="e.g. 9151609682"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-700 text-white font-mono-nums text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Account Holder Name */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
                    Account Holder Name
                  </label>
                  {isResolvingNuban && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 font-mono">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
                    </span>
                  )}
                  {nubanResolved && !isResolvingNuban && (
                    <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono font-bold">
                      <CheckCircle2 className="w-3 h-3" /> Auto-Verified
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Legal full name on bank account"
                  className={`w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border text-xs focus:outline-none ${
                    nubanResolved ? 'border-emerald-500/50 text-emerald-300 font-bold' : 'border-neutral-700 text-white'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingBank(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingBank || isResolvingNuban}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-black transition-all cursor-pointer uppercase shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingBank ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving to Database...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Bank Details Permanently</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TELEGRAM BOT MATCH ACCEPTANCE ALERTS                       */}
      {/* ------------------------------------------------------------- */}
      <div className="rounded-3xl bg-neutral-900 border-2 border-sky-500/40 p-6 sm:p-7 space-y-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 text-sky-400 pointer-events-none">
          <Send className="w-32 h-32" />
        </div>

        {/* Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black font-heading text-white uppercase tracking-wide">
                  Telegram Instant Match Alerts
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Bot Token Active
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                Receive instant Telegram notifications on your phone whenever an opponent accepts your 1v1 wager match challenge!
              </p>
            </div>
          </div>
        </div>

        {telegramFeedback && (
          <div className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-in fade-in ${
            telegramFeedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {telegramFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            )}
            <span>{telegramFeedback.msg}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-sky-400" />
                <span>How to Link Your Telegram Account</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">Bot Token: 8886701427:AAE5...</span>
            </div>

            <ol className="text-xs text-neutral-300 space-y-1.5 list-decimal list-inside font-sans">
              <li>Open Telegram and search for <b>@userinfobot</b> or start our bot.</li>
              <li>Send any message to <b>@userinfobot</b> to view your <b>numerical Chat ID</b> (e.g., <code>987654321</code>).</li>
              <li>Paste your Chat ID below and tap <b>Save ID & Test Telegram Alert</b>.</li>
            </ol>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Enter Numerical Telegram Chat ID (e.g. 987654321)"
                className="w-full px-4 py-3 rounded-2xl bg-neutral-950 border border-neutral-700 text-white font-mono-nums text-xs focus:outline-none focus:border-sky-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveTelegramId}
                disabled={isSavingTelegram}
                className="px-4 py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-black text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isSavingTelegram ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save ID</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSendTestAlert}
                disabled={isSendingTestAlert || !telegramChatId.trim()}
                className="px-4 py-3 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs uppercase tracking-wider cursor-pointer whitespace-nowrap shadow-md flex items-center justify-center gap-1.5 border border-neutral-700 disabled:opacity-50"
              >
                {isSendingTestAlert ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Sending Test...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    <span>Test Telegram Alert</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. EDIT PROFILE FORM (TOGGLE)                                  */}
      {/* ------------------------------------------------------------- */}
      {isEditing && (
        <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <h3 className="text-base font-black font-heading text-white uppercase flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>Update In-Game Gamer Tag & Credentials</span>
            </h3>
            <span className="text-xs text-neutral-400 font-mono">CODM ESCR-LINK</span>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            {/* Avatar Selector */}
            <div>
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-2 font-mono">
                Select Operator Avatar
              </label>
              <div className="flex flex-wrap gap-3">
                {AVATAR_OPTIONS.map((av, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(av)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                      selectedAvatar === av
                        ? 'border-amber-400 scale-105 shadow-lg'
                        : 'border-neutral-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={av} alt="Avatar option" className="w-12 h-12 rounded-lg object-cover" />
                    {selectedAvatar === av && (
                      <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center text-[8px] font-black">
                        ✓
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
                  In-Game Username (IGN)
                </label>
                <input
                  type="text"
                  value={editIgn}
                  onChange={(e) => setEditIgn(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:outline-none focus:border-amber-400 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
                  Player ID / UID
                </label>
                <input
                  type="text"
                  value={editUid}
                  onChange={(e) => setEditUid(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:outline-none focus:border-amber-400 font-mono-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
                  Email Address
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
                  Phone Number (SMS Match Alerts)
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:outline-none focus:border-amber-400 font-mono-nums"
                />
              </div>
            </div>

            {/* Saved Bank Details for Payouts */}
            <div className="p-4 rounded-2xl bg-neutral-950 border border-amber-500/30 space-y-3">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Saved Bank Details for Automated Payouts</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                When you win a 1v1 match, winnings are automatically disbursed to your saved bank account.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Bank Name</label>
                  <input
                    type="text"
                    placeholder="e.g. OPay, GTBank, Kuda"
                    value={editBankName}
                    onChange={(e) => setEditBankName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Account Number</label>
                  <input
                    type="text"
                    placeholder="0123456789"
                    value={editAccountNumber}
                    onChange={(e) => setEditAccountNumber(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs font-mono-nums focus:border-amber-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">Account Name</label>
                  <input
                    type="text"
                    placeholder="Full legal name"
                    value={editAccountName}
                    onChange={(e) => setEditAccountName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black transition-all shadow-md cursor-pointer uppercase"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 3. LIFETIME COMBAT ANALYTICS                                  */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="text-[10px] text-neutral-400 font-mono uppercase">Total Matches</div>
          <div className="text-2xl font-black text-white font-mono-nums">{currentUser.wins + currentUser.losses}</div>
          <div className="text-[10px] text-neutral-500 font-mono">1v1 & Squad Duels</div>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="text-[10px] text-neutral-400 font-mono uppercase">Victory Rate</div>
          <div className="text-2xl font-black text-emerald-400 font-mono-nums">{winRate}%</div>
          <div className="text-[10px] text-emerald-400/80 font-mono">{currentUser.wins} Wins Total</div>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="text-[10px] text-neutral-400 font-mono uppercase">Total Winnings</div>
          <div className="text-2xl font-black text-amber-400 font-mono-nums">₦{currentUser.totalWinnings.toLocaleString()}</div>
          <div className="text-[10px] text-amber-400/80 font-mono">Escrow Payouts</div>
        </div>

        <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
          <div className="text-[10px] text-neutral-400 font-mono uppercase">Defeats</div>
          <div className="text-2xl font-black text-rose-400 font-mono-nums">{currentUser.losses}</div>
          <div className="text-[10px] text-neutral-500 font-mono">Settled Losses</div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. GLOBAL TACTICAL SOUND SETTINGS                             */}
      {/* ------------------------------------------------------------- */}
      <div className="p-5 sm:p-6 rounded-3xl bg-neutral-900/90 border border-neutral-800 shadow-xl relative overflow-hidden">
        {/* Ambient glow */}
        <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-500 ${
          soundEnabled ? 'bg-amber-500/10' : 'bg-neutral-800/10'
        }`} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border transition-all duration-300 ${
              soundEnabled
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 shadow-lg shadow-amber-500/10'
                : 'bg-neutral-800/80 border-neutral-700 text-neutral-500'
            }`}>
              {soundEnabled ? (
                <Volume2 className="w-6 h-6 stroke-[2.2]" />
              ) : (
                <VolumeX className="w-6 h-6 stroke-[2.2]" />
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h3 className="font-heading font-black text-base sm:text-lg text-white uppercase tracking-wide">
                  Shotgun Fire Sound Effects
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border transition-all ${
                  soundEnabled
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    soundEnabled ? 'bg-amber-400 animate-pulse' : 'bg-neutral-500'
                  }`} />
                  {soundEnabled ? 'ENABLED' : 'MUTED'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 max-w-md leading-relaxed">
                Plays an authentic 12-gauge shotgun blast effect when tapping navigation tabs and entering combat arenas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 sm:pt-0 shrink-0">
            {/* Test Fire Button */}
            <button
              type="button"
              onClick={() => {
                playShotgunSound();
                setSoundTestPlayed(true);
                setTimeout(() => setSoundTestPlayed(false), 1000);
              }}
              disabled={!soundEnabled}
              title={soundEnabled ? "Preview shotgun blast sound" : "Enable sound to test fire"}
              className={`px-3.5 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border ${
                soundEnabled
                  ? 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-amber-400 hover:border-amber-500/50 active:scale-95'
                  : 'bg-neutral-900/50 border-neutral-800 text-neutral-600 cursor-not-allowed opacity-50'
              }`}
            >
              <Crosshair className={`w-3.5 h-3.5 ${soundTestPlayed ? 'animate-spin text-amber-400' : ''}`} />
              <span>{soundTestPlayed ? 'BLAST FIRED!' : 'TEST FIRE'}</span>
            </button>

            {/* Tactical Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={soundEnabled}
              onClick={toggleSound}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
                soundEnabled
                  ? 'bg-amber-500 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.35)]'
                  : 'bg-neutral-800 border-neutral-700'
              }`}
            >
              <span className="sr-only">Toggle shotgun sound effects</span>
              <span
                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full shadow-md ring-0 transition duration-300 ease-in-out mt-0.5 ${
                  soundEnabled ? 'translate-x-6 bg-neutral-950' : 'translate-x-0.5 bg-neutral-400'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. DEDICATED SEPARATE TAB LINKS                               */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={onNavigateToArena}
          className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 transition-all cursor-pointer group space-y-2.5"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-heading font-black text-sm text-white uppercase">Arena & Challenges</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Create custom wagers, jump into active battles, and share challenge links.
            </p>
          </div>
        </div>

        <div
          onClick={onNavigateToReferrals}
          className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-emerald-400/60 transition-all cursor-pointer group space-y-2.5"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-heading font-black text-sm text-white uppercase">Referral Program</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Manage your referral link, track your earnings, and view your stats.
            </p>
          </div>
        </div>

        <div
          onClick={onNavigateToHistory}
          className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-emerald-400/60 transition-all cursor-pointer group space-y-2.5"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-heading font-black text-sm text-white uppercase">Match History</h4>
            <p className="text-xs text-neutral-400 mt-0.5">
              Review completed battles, screenshots, and victory payouts.
            </p>
          </div>
        </div>
        
        {currentUser.role === 'admin' && (
          <div
            onClick={() => window.location.href = '/msksksnuwje'}
            className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 hover:border-amber-400/60 transition-all cursor-pointer group space-y-2.5"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-heading font-black text-sm text-white uppercase">Admin Dashboard</h4>
              <p className="text-xs text-neutral-400 mt-0.5">
                Manage platform fees and system settings.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
