import React, { useState } from 'react';
import { UserProfile, Match } from '../types';
import {
  User, Trophy, Award, TrendingUp, ShieldCheck, Swords,
  Edit3, Check, Copy, ArrowRight, Shield, Zap, Flame, Clock,
  Calendar, CheckCircle2, AlertCircle, Camera, Crosshair, Users, LogOut, BookOpen
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';

interface ProfilePageProps {
  currentUser: UserProfile;
  matches: Match[];
  onUpdateUser?: (updated: Partial<UserProfile>) => Promise<void>;
  onCashOut?: (amount: number, bankDetails: { bankName: string; accountNumber: string; accountName: string }) => Promise<void>;
  onNavigateToArena: () => void;
  onNavigateToHistory: () => void;
  onNavigateToRules: () => void;
  onOpenCreateBet: (mode?: string, stake?: number) => void;
  onSignOut?: () => void;
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
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap md:flex-col gap-2.5">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit CODM Info'}</span>
              </button>

              <button
                onClick={() => onOpenCreateBet('1v1 Sniper Only', 1000)}
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

      {/* Cash Out / Bank Payout Card */}
      <div className="p-6 rounded-3xl bg-neutral-900 border-2 border-emerald-500/30 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4" />
              <span>Available Wallet Balance for Cash Out</span>
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
                ⚠️ No bank details saved yet. Edit profile below to save your bank details before cashing out.
              </p>
            )}
          </div>

          <button
            onClick={() => {
              if (!currentUser.bankName || !currentUser.accountNumber) {
                setIsEditing(true);
                alert('Please save your bank details first before cashing out.');
                return;
              }
              const amountToCashOut = currentUser.balance;
              if (amountToCashOut <= 0) {
                alert('No available balance to cash out.');
                return;
              }
              if (onCashOut) {
                onCashOut(amountToCashOut, {
                  bankName: currentUser.bankName,
                  accountNumber: currentUser.accountNumber,
                  accountName: currentUser.accountName || currentUser.codmIgn,
                });
              }
            }}
            disabled={currentUser.balance <= 0}
            className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-sm transition-all shadow-lg cursor-pointer uppercase flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>Cash Out ₦{currentUser.balance.toLocaleString()}</span>
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Profile information successfully updated!</span>
        </div>
      )}

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
                  Call of Duty In-Game Name (IGN)
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
                  CODM Player ID (UID)
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
      {/* 4. DEDICATED SEPARATE TAB LINKS                               */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </div>
    </div>
  );
};
