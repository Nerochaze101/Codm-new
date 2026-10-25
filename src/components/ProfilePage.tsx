import React, { useState, useEffect } from 'react';
import { UserProfile, Match } from '../types';
import {
  User, Trophy, Award, TrendingUp, ShieldCheck, Swords,
  Check, Copy, Shield, Zap, Building, Lock, Loader2, Save, Send,
  Settings, ExternalLink, Volume2, VolumeX, Crosshair, LogOut,
  Camera, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';
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
  onNavigateToArena,
  onNavigateToHistory,
  onNavigateToReferrals,
  onOpenCreateBet,
  onSignOut,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'bank' | 'telegram' | 'settings'>('overview');

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editIgn, setEditIgn] = useState(currentUser.codmIgn);
  const [editUid, setEditUid] = useState(currentUser.codmUid);
  const [editEmail, setEditEmail] = useState(currentUser.email);
  const [editPhone, setEditPhone] = useState(currentUser.phone);
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar);
  const [copiedUid, setCopiedUid] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sound
  const { soundEnabled, toggleSound } = useSoundSettings();
  const [soundTestPlayed, setSoundTestPlayed] = useState(false);

  // Bank State
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankName, setBankName] = useState(currentUser.bankName || 'OPay Digital Bank');
  const [accountNumber, setAccountNumber] = useState(currentUser.accountNumber || '');
  const [accountName, setAccountName] = useState(currentUser.accountName || '');
  const [isResolvingNuban, setIsResolvingNuban] = useState(false);
  const [nubanError, setNubanError] = useState<string | null>(null);
  const [nubanResolved, setNubanResolved] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);

  // Telegram State
  const [telegramChatId, setTelegramChatId] = useState(currentUser.telegramChatId || '');
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [telegramFeedback, setTelegramFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [botUsername, setBotUsername] = useState('OpsSTAKEBOT');
  const [copiedBotLink, setCopiedBotLink] = useState(false);
  const [isUnlinkingTelegram, setIsUnlinkingTelegram] = useState(false);
  const [showManualChatId, setShowManualChatId] = useState(false);

  const telegramDeepLink = `https://t.me/${botUsername}?start=link_${currentUser.id}`;

  useEffect(() => {
    fetch('/api/telegram/bot-info')
      .then(r => r.json())
      .then(d => {
        if (d.botUsername) setBotUsername(d.botUsername);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentUser.bankName) setBankName(currentUser.bankName);
    if (currentUser.accountNumber) setAccountNumber(currentUser.accountNumber);
    if (currentUser.accountName) setAccountName(currentUser.accountName);
    if (currentUser.telegramChatId) setTelegramChatId(currentUser.telegramChatId);
  }, [currentUser.bankName, currentUser.accountNumber, currentUser.accountName, currentUser.telegramChatId]);

  const winRate =
    currentUser.wins + currentUser.losses > 0
      ? Math.round((currentUser.wins / (currentUser.wins + currentUser.losses)) * 100)
      : 0;

  const handleCopyUid = () => {
    navigator.clipboard.writeText(currentUser.codmUid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleCopyBank = () => {
    if (!currentUser.accountNumber) return;
    navigator.clipboard.writeText(currentUser.accountNumber);
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2000);
  };

  const handleCopyBotLink = () => {
    navigator.clipboard.writeText(telegramDeepLink);
    setCopiedBotLink(true);
    setTimeout(() => setCopiedBotLink(false), 2500);
  };

  const handleUnlinkTelegram = async () => {
    setIsUnlinkingTelegram(true);
    setTelegramFeedback(null);
    try {
      const res = await fetch('/api/telegram/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        if (onUpdateUser) {
          await onUpdateUser({ telegramChatId: '', telegramUsername: '' });
        }
        setTelegramChatId('');
        setTelegramFeedback({ type: 'success', msg: 'Telegram Bot disconnected successfully.' });
        setTimeout(() => setTelegramFeedback(null), 3000);
      }
    } catch (err: any) {
      setTelegramFeedback({ type: 'error', msg: 'Failed to unlink Telegram.' });
    } finally {
      setIsUnlinkingTelegram(false);
    }
  };

  const handleSaveTelegramId = async () => {
    setIsSavingTelegram(true);
    setTelegramFeedback(null);
    try {
      if (onUpdateUser) {
        await onUpdateUser({
          telegramChatId: telegramChatId.trim(),
        });
      }
      setTelegramFeedback({ type: 'success', msg: 'Telegram Chat ID saved successfully!' });
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
        setTelegramFeedback({ type: 'success', msg: data.message || 'Test alert sent to Telegram!' });
      } else {
        setTelegramFeedback({ type: 'error', msg: data.error || 'Failed to send alert.' });
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
      } else {
        setNubanError(data.message || 'Could not resolve NUBAN name.');
      }
    } catch (err: any) {
      setNubanError('Network error resolving account.');
    } finally {
      setIsResolvingNuban(false);
    }
  };

  const handleAccountNumberChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10);
    setAccountNumber(cleaned);
    if (cleaned.length === 10) {
      resolveBankDetails(cleaned, bankName);
    } else {
      setAccountName('');
      setNubanResolved(false);
    }
  };

  const handleBankChange = (newBank: string) => {
    setBankName(newBank);
    if (accountNumber.length === 10) {
      resolveBankDetails(accountNumber, newBank);
    }
  };

  const handleSavePermanentBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountNumber || accountNumber.length !== 10) {
      setNubanError('Account number must be exactly 10 digits');
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
    } catch (err: any) {
      setNubanError(err.message || 'Failed to save bank details');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateUser) {
      await onUpdateUser({
        codmIgn: editIgn.trim() || currentUser.codmIgn,
        codmUid: editUid.trim() || currentUser.codmUid,
        email: editEmail.trim() || currentUser.email,
        phone: editPhone.trim() || currentUser.phone,
        avatar: selectedAvatar,
      });
    }
    setIsEditing(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16 animate-in fade-in duration-300">
      {/* ------------------------------------------------------------- */}
      {/* 1. CLEAN PLAYER IDENTITY HEADER CARD                           */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-6">
          {/* Avatar & Player Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-amber-400 bg-neutral-950 shadow-lg">
                <img
                  src={currentUser.avatar}
                  alt={currentUser.codmIgn}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={(e) => { (e.target as HTMLImageElement).src = AVATAR_OPTIONS[0]; }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-white uppercase font-heading tracking-tight">
                  {currentUser.codmIgn}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono text-[10px] font-bold">
                  PRO GAMER
                </span>
              </div>

              {/* CODM UID & Badges */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black/60 border border-neutral-800 text-xs font-mono">
                  <span className="text-neutral-400 font-medium">CODM UID:</span>
                  <span className="text-neutral-200 font-bold">{currentUser.codmUid}</span>
                  <button onClick={handleCopyUid} className="p-1 hover:text-amber-400 text-neutral-500 transition-colors cursor-pointer">
                    {copiedUid ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>

                {currentUser.email && (
                  <span className="px-3 py-1 rounded-xl bg-black/60 border border-neutral-800 text-xs font-mono text-neutral-300">
                    {currentUser.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <Settings size={16} />
              <span>Edit Profile</span>
            </button>

            {onSignOut && (
              <button
                onClick={onSignOut}
                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <LogOut size={16} />
                <span>Log Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Performance Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 mt-6 border-t border-neutral-800">
          <div className="p-3.5 rounded-2xl bg-black/50 border border-neutral-800 text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Wallet Balance</div>
            <div className="text-xl font-black text-amber-400 font-mono pt-0.5">₦{currentUser.balance.toLocaleString()}</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/50 border border-neutral-800 text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Victories</div>
            <div className="text-xl font-black text-emerald-400 font-mono pt-0.5">{currentUser.wins}W</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/50 border border-neutral-800 text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Defeats</div>
            <div className="text-xl font-black text-rose-400 font-mono pt-0.5">{currentUser.losses}L</div>
          </div>

          <div className="p-3.5 rounded-2xl bg-black/50 border border-neutral-800 text-center">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Win Rate</div>
            <div className="text-xl font-black text-white font-mono pt-0.5">{winRate}%</div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. NAVIGATION TABS                                            */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900 border border-neutral-800">
        {[
          { id: 'overview', label: 'Stats & Activity', icon: Trophy },
          { id: 'bank', label: 'Treasury & Bank', icon: Building },
          { id: 'telegram', label: 'Telegram Bot', icon: Send },
          { id: 'settings', label: 'Preferences', icon: Settings },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 py-3 px-3 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-amber-400 text-neutral-950 font-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <tab.icon size={16} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. TAB 1: OVERVIEW & STATS                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Quick Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={onNavigateToArena}
              className="p-6 rounded-2xl bg-neutral-900 border border-amber-500/20 hover:border-amber-400/50 transition-all text-left group shadow-lg cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Zap size={20} />
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Battle Arena</h3>
              <p className="text-xs text-neutral-400 pt-1">Deploy duels or accept live wager challenges.</p>
            </button>

            <button
              onClick={onNavigateToHistory}
              className="p-6 rounded-2xl bg-neutral-900 border border-emerald-500/20 hover:border-emerald-400/50 transition-all text-left group shadow-lg cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/30 text-emerald-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Trophy size={20} />
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Match History</h3>
              <p className="text-xs text-neutral-400 pt-1">View past victories, payouts, and combat log.</p>
            </button>

            <button
              onClick={onNavigateToReferrals}
              className="p-6 rounded-2xl bg-neutral-900 border border-cyan-500/20 hover:border-cyan-400/50 transition-all text-left group shadow-lg cursor-pointer"
            >
              <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Award size={20} />
              </div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Referral Rewards</h3>
              <p className="text-xs text-neutral-400 pt-1">Earn 10% lifetime platform fee rewards.</p>
            </button>
          </div>

          {/* Total Earnings Summary Card */}
          <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4">
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
              <TrendingUp size={20} className="text-amber-400" />
              <span>Combat Career Earnings</span>
            </h3>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-black/60 border border-neutral-800">
              <div>
                <div className="text-xs text-neutral-400 font-medium">Total Career Earnings</div>
                <div className="text-3xl font-black text-white font-mono tracking-tight pt-1">
                  <span className="text-amber-400">₦</span>{currentUser.totalWinnings.toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => onOpenCreateBet('1v1 Sniper Only', 1000)}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg"
              >
                Deploy New Duel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 4. TAB 2: TREASURY & BANK                                     */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'bank' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Building size={20} className="text-emerald-400" />
                  <span>Withdrawal Bank Account</span>
                </h3>
                <p className="text-xs text-neutral-400 pt-0.5">Your official NUBAN account for instant escrow payouts.</p>
              </div>
              <button
                onClick={() => setIsEditingBank(!isEditingBank)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase transition-all cursor-pointer"
              >
                {isEditingBank ? 'Cancel' : 'Modify Bank'}
              </button>
            </div>

            {!isEditingBank ? (
              currentUser.bankName ? (
                <div className="p-6 bg-black/60 rounded-2xl border border-neutral-800 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-xs text-neutral-400 font-medium">Settlement Bank</div>
                      <div className="text-lg font-black text-white pt-0.5">{currentUser.bankName}</div>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase">
                      ACTIVE LINKED
                    </span>
                  </div>

                  <div className="flex justify-between items-end pt-2">
                    <div>
                      <div className="text-xs text-neutral-400 font-medium">NUBAN Account Number</div>
                      <div className="text-2xl font-black text-amber-400 font-mono pt-0.5">{currentUser.accountNumber}</div>
                    </div>
                    <button onClick={handleCopyBank} className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-300 transition-colors cursor-pointer">
                      {copiedBank ? <Check size={18} className="text-emerald-400" /> : <Copy size={18} />}
                    </button>
                  </div>

                  {currentUser.accountName && (
                    <div className="pt-3 border-t border-neutral-800/60 text-xs">
                      <span className="text-neutral-400">Verified Beneficiary Name: </span>
                      <strong className="text-emerald-400 font-bold uppercase">{currentUser.accountName}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center space-y-4 bg-black/40 rounded-2xl border border-dashed border-neutral-800">
                  <Building size={32} className="text-neutral-500 mx-auto" />
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase">No Bank Account Linked</h4>
                    <p className="text-xs text-neutral-400 pt-1">Link your NUBAN bank account to receive automatic cash withdrawals.</p>
                  </div>
                  <button onClick={() => setIsEditingBank(true)} className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase rounded-xl transition-all shadow-md">
                    Link Bank Account
                  </button>
                </div>
              )
            ) : (
              <form onSubmit={handleSavePermanentBank} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Select Bank Provider</label>
                  <select
                    value={bankName}
                    onChange={(e) => handleBankChange(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-emerald-400 focus:outline-none"
                  >
                    {SUPPORTED_BANKS.map((b) => (
                      <option key={b.name} value={b.name} className="bg-neutral-900">{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-400 uppercase">10-Digit NUBAN Account Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => handleAccountNumberChange(e.target.value)}
                    placeholder="0123456789"
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-base font-mono font-black text-amber-400 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-neutral-400 uppercase">Account Name</label>
                    {isResolvingNuban && <span className="text-xs text-amber-400 animate-pulse font-mono">Verifying NUBAN...</span>}
                  </div>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="ACCOUNT NAME"
                    className={`w-full bg-black border rounded-xl px-4 py-3 text-xs font-bold uppercase ${nubanResolved ? 'border-emerald-500 text-emerald-400' : 'border-neutral-800 text-white'}`}
                  />
                </div>

                {nubanError && <p className="text-xs text-rose-400 font-bold uppercase">{nubanError}</p>}

                <button
                  type="submit"
                  disabled={isSavingBank || isResolvingNuban}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingBank ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span>Save Bank Account</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TAB 3: TELEGRAM BOT                                        */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'telegram' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Send size={20} className="text-cyan-400" />
                  <span>Telegram Bot & Channel Connection</span>
                </h3>
                <p className="text-xs text-neutral-400 pt-0.5">Receive instant match updates, in-game CODM room codes, and wager notifications.</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${currentUser.telegramChatId ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'}`}>
                {currentUser.telegramChatId ? 'LINKED' : 'DISCONNECTED'}
              </span>
            </div>

            {/* Official Channel Card */}
            <div className="p-5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold text-cyan-300 uppercase">Official Channel (@OpsSTAKE)</div>
                <p className="text-xs text-neutral-300 pt-0.5">Join for live rival games, tournaments, and announcements.</p>
              </div>
              <a
                href="https://t.me/OpsSTAKE"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 text-xs font-black uppercase rounded-xl transition-all flex items-center gap-1.5 shrink-0"
              >
                Join Channel <ExternalLink size={14} />
              </a>
            </div>

            {currentUser.telegramChatId ? (
              <div className="p-6 bg-black/60 rounded-2xl border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 size={24} className="text-emerald-400" />
                    <div>
                      <div className="text-sm font-bold text-white">Telegram Account Connected</div>
                      <div className="text-xs text-neutral-400 font-mono">Chat ID: {currentUser.telegramChatId}</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkTelegram}
                    disabled={isUnlinkingTelegram}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
                  >
                    Disconnect
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendTestAlert}
                  disabled={isSendingTestAlert}
                  className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold text-white uppercase rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSendingTestAlert ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  <span>Send Test Notification Ping</span>
                </button>
              </div>
            ) : (
              <div className="p-6 bg-black/60 rounded-2xl border border-neutral-800 space-y-4">
                <div>
                  <h4 className="text-white font-bold text-sm uppercase">1-Tap Telegram Connection</h4>
                  <p className="text-xs text-neutral-400 pt-1">Click the button below to connect your Telegram account with 1 tap.</p>
                </div>

                <a
                  href={telegramDeepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Zap size={16} fill="black" />
                  <span>1-Tap Connect Telegram Bot</span>
                </a>
              </div>
            )}

            {telegramFeedback && (
              <div className={`p-3.5 rounded-xl text-xs font-bold uppercase flex items-center gap-2 ${telegramFeedback.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}`}>
                {telegramFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{telegramFeedback.msg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. TAB 4: SETTINGS & AUDIO                                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'settings' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6">
            <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2 border-b border-neutral-800 pb-4">
              <Settings size={20} className="text-amber-400" />
              <span>App Preferences & Audio</span>
            </h3>

            {/* Audio Toggle Card */}
            <div className="p-5 rounded-2xl bg-black/60 border border-neutral-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${soundEnabled ? 'bg-amber-400/10 border-amber-400/30 text-amber-400' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                  {soundEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">Audio FX Feedback</div>
                  <p className="text-xs text-neutral-400">Tactical sound effects for button clicks and wager alerts.</p>
                </div>
              </div>

              <button
                onClick={toggleSound}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${soundEnabled ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-800 text-neutral-400'}`}
              >
                {soundEnabled ? 'ENABLED' : 'MUTED'}
              </button>
            </div>

            {/* Edit Credentials Trigger */}
            <div className="p-5 rounded-2xl bg-black/60 border border-neutral-800 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-white">Gamer Tag & Profile Credentials</div>
                <p className="text-xs text-neutral-400">Update your CODM IGN, UID, email, and phone number.</p>
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold uppercase transition-all cursor-pointer"
              >
                Edit Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* EDIT PROFILE MODAL                                            */}
      {/* ------------------------------------------------------------- */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-4">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Edit Profile</h3>
              <button onClick={() => setIsEditing(false)} className="p-2 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Avatar Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Select Avatar</label>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {AVATAR_OPTIONS.map((av, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatar(av)}
                      className={`relative w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 ${selectedAvatar === av ? 'border-amber-400 scale-105' : 'border-neutral-800 opacity-60'}`}
                    >
                      <img src={av} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase">CODM In-Game Name (IGN)</label>
                <input
                  type="text"
                  value={editIgn}
                  onChange={(e) => setEditIgn(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase">CODM Player UID</label>
                <input
                  type="text"
                  value={editUid}
                  onChange={(e) => setEditUid(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono font-bold text-neutral-300 focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Email Address</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-neutral-400 uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-amber-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-md"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-emerald-500 text-neutral-950 px-6 py-3 rounded-xl font-bold text-xs uppercase shadow-xl flex items-center gap-2">
          <CheckCircle2 size={18} /> Profile details updated successfully!
        </div>
      )}
    </div>
  );
};
