import React, { useState } from 'react';
import { UserProfile } from '../types';
import {
  Swords, ShieldCheck, Mail, Lock, Eye, EyeOff, Crosshair, Target,
  Phone, Building2, CreditCard, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Sparkles, UserCheck, Loader2
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { Logo } from './Logo';

interface AuthPageProps {
  initialMode?: 'signin' | 'signup';
  onSignUp: (data: {
    email: string;
    password: string;
    codmIgn: string;
    codmUid: string;
    phone: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    initialDeposit: number;
    referralCode?: string;
  }) => Promise<void>;
  onSignIn: (data: {
    identifier: string;
    password: string;
  }) => Promise<void>;
  onBackToLanding: () => void;
  demoUsers?: Record<string, UserProfile>;
  onGoogleSuccess?: (user: UserProfile) => void;
}

const NIGERIAN_BANKS = [
  'OPay Digital Services Limited (OPay)',
  'PalmPay',
  'Kuda Bank',
  'Moniepoint Microfinance Bank',
  'Guaranty Trust Bank (GTB)',
  'Zenith Bank',
  'Access Bank',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Wema Bank',
  'Stanbic IBTC Bank',
  'Fidelity Bank',
  'Sterling Bank',
  'First City Monument Bank (FCMB)',
  'Union Bank',
  'Providus Bank',
];

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'signup',
  onSignUp,
  onSignIn,
  onBackToLanding,
  demoUsers,
}) => {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);

  // Sign Up Form State
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupCodmIgn, setSignupCodmIgn] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupBankName, setSignupBankName] = useState('OPay Digital Services Limited (OPay)');
  const [signupAccountNumber, setSignupAccountNumber] = useState('');
  const [signupAccountName, setSignupAccountName] = useState('');
  const [isResolvingNuban, setIsResolvingNuban] = useState(false);
  const [nubanResolved, setNubanResolved] = useState(false);
  const [nubanError, setNubanError] = useState<string | null>(null);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [signupReferralCode, setSignupReferralCode] = useState('');

  // Sign In Form State
  const [signinIdentifier, setSigninIdentifier] = useState('');
  const [signinPassword, setSigninPassword] = useState('');
  const [showSigninPassword, setShowSigninPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveBankDetails = async (accNum: string, bank: string) => {
    if (accNum.length !== 10) return;
    setIsResolvingNuban(true);
    setNubanError(null);
    setNubanResolved(false);

    try {
      const res = await fetch(`/api/resolve-account?account_number=${encodeURIComponent(accNum)}&bank_name=${encodeURIComponent(bank)}`);
      const data = await res.json();
      if (data.status && data.data?.account_name) {
        setSignupAccountName(data.data.account_name);
        setNubanResolved(true);
        setNubanError(null);
      } else {
        setNubanResolved(false);
        setSignupAccountName('');
        setNubanError(data.error || data.message || `Could not verify account name with ${bank}. Please check the account number.`);
      }
    } catch (err: any) {
      setNubanResolved(false);
      setSignupAccountName('');
      setNubanError('Network error checking bank account. Please verify internet connection.');
    } finally {
      setIsResolvingNuban(false);
    }
  };

  const handleAccountNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 10);
    setSignupAccountNumber(val);
    setNubanResolved(false);
    setNubanError(null);

    if (val.length === 10) {
      resolveBankDetails(val, signupBankName);
    } else {
      setSignupAccountName('');
    }
  };

  const handleBankNameChange = (newBank: string) => {
    setSignupBankName(newBank);
    setNubanResolved(false);
    setNubanError(null);
    if (signupAccountNumber.length === 10) {
      resolveBankDetails(signupAccountNumber, newBank);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signupEmail.trim() || !signupEmail.includes('@')) {
      setError('Please provide a valid Gmail/email address');
      return;
    }
    if (!signupPassword || signupPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (!signupCodmIgn.trim()) {
      setError('Please enter your Call of Duty: Mobile username (IGN)');
      return;
    }
    if (!signupPhone.trim() || signupPhone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }
    if (!signupAccountNumber.trim() || signupAccountNumber.length !== 10) {
      setError('Please enter a valid 10-digit Nigerian bank account number');
      return;
    }
    if (!signupAccountName.trim()) {
      setError('Please wait for account resolution or enter your official legal account name');
      return;
    }

    setLoading(true);
    try {
      await onSignUp({
        email: signupEmail.trim(),
        password: signupPassword,
        codmIgn: signupCodmIgn.trim(),
        codmUid: `67${Math.floor(10000000000000 + Math.random() * 90000000000000)}`,
        phone: signupPhone.trim(),
        bankName: signupBankName,
        accountNumber: signupAccountNumber.trim(),
        accountName: signupAccountName || `${signupCodmIgn.trim()} (Verified)`,
        initialDeposit: 0,
        referralCode: signupReferralCode.trim(),
      });
    } catch (err: any) {
      setError(err.message || 'Account registration failed');
      setLoading(false);
    }
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!signinIdentifier.trim()) {
      setError('Please enter your registered email or CODM username');
      return;
    }

    setLoading(true);
    try {
      await onSignIn({
        identifier: signinIdentifier.trim(),
        password: signinPassword,
      });
    } catch (err: any) {
      setError(err.message || 'Sign in failed');
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (user: UserProfile) => {
    setError(null);
    setLoading(true);
    try {
      await onSignIn({
        identifier: user.codmIgn,
        password: 'password123',
      });
    } catch (err: any) {
      setError(err.message || 'Demo sign in failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col justify-between relative overflow-hidden bg-tactical-grid selection:bg-amber-500 selection:text-black py-8 px-4 sm:px-6">
      {/* Background CODM Action Hero overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <img
          src={CODM_IMAGES.heroAction}
          alt="CODM Action Background"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={(e) => {
            (e.target as HTMLImageElement).src = CODM_IMAGES.heroActionFallback;
          }}
        />
        <div className="absolute inset-0 bg-neutral-950/85" />
      </div>

      {/* Top Header Bar */}
      <div className="relative z-10 max-w-5xl w-full mx-auto flex items-center justify-between pb-6">
        <button
          onClick={onBackToLanding}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-amber-400 text-xs font-bold transition-all cursor-pointer backdrop-blur-md"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Landing Page</span>
        </button>

        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <span className="font-heading font-black text-lg tracking-wide text-white">
              OPS STAKE
            </span>
            <div className="text-[10px] text-neutral-400 font-mono-nums leading-none">
              ESPORTS ESCROW ARENA
            </div>
          </div>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="relative z-10 max-w-lg w-full mx-auto my-auto bg-neutral-900/95 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden backdrop-blur-xl">
        {/* Toggle Mode Tabs */}
        <div className="grid grid-cols-2 p-1.5 bg-neutral-950/80 border-b border-neutral-800">
          <button
            type="button"
            onClick={() => { setMode('signup'); setError(null); }}
            className={`py-3 text-xs sm:text-sm font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider ${
              mode === 'signup'
                ? 'bg-amber-400 text-neutral-950 shadow-lg'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Crosshair className="w-4 h-4" />
            <span>Create Account</span>
          </button>

          <button
            type="button"
            onClick={() => { setMode('signin'); setError(null); }}
            className={`py-3 text-xs sm:text-sm font-black rounded-2xl transition-all cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider ${
              mode === 'signin'
                ? 'bg-amber-400 text-neutral-950 shadow-lg'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Sign In</span>
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          {/* Header Title */}
          <div>
            <h2 className="text-xl sm:text-2xl font-black font-heading text-white tracking-wide uppercase">
              {mode === 'signup' ? 'Create OPS Stake Account' : 'Sign In to Your Account'}
            </h2>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {mode === 'signup'
                ? 'Register with your gamer tag and permanent NUBAN banking details to prevent multiple accounts & payment lockups.'
                : 'Access your wallet, open match rooms, and battle arena.'}
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* ===================== SIGN UP FORM ===================== */}
          {mode === 'signup' ? (
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              {/* Email Address */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Gmail / Email Address <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="email"
                  required
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="e.g. soldier@gmail.com"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Password <span className="text-rose-400">*</span></span>
                </label>
                <div className="relative">
                  <input
                    type={showSignupPassword ? 'text' : 'password'}
                    required
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    placeholder="Create a secure password (min 4 chars)"
                    className="w-full pl-4 pr-11 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignupPassword(!showSignupPassword)}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showSignupPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* In-Game Username (IGN) */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Crosshair className="w-3.5 h-3.5 text-amber-400" />
                  <span>In-Game Username / Gamer Tag (IGN) <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={signupCodmIgn}
                  onChange={(e) => setSignupCodmIgn(e.target.value)}
                  placeholder="e.g. Ghost_Sniper99"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Referral Code */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Referral Code (Optional)</span>
                </label>
                <input
                  type="text"
                  value={signupReferralCode}
                  onChange={(e) => setSignupReferralCode(e.target.value)}
                  placeholder="e.g. FRIEND123"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>



              {/* Phone Number */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-amber-400" />
                  <span>Phone Number <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="tel"
                  required
                  value={signupPhone}
                  onChange={(e) => setSignupPhone(e.target.value)}
                  placeholder="e.g. 08012345678"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono-nums text-sm focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>

                            {/* Permanent Banking Details Card */}
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-amber-400/40 space-y-2.5">
                <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800/80">
                  <span className="text-[11px] font-black uppercase text-amber-400 flex items-center gap-1 font-heading">
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    Permanent Banking Details (Locked)
                  </span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                    ANTI-FRAUD LOCKED
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 leading-snug">
                  Permanently locked to your account for safe deposits & instant cashouts.
                </p>

                {/* Bank Name Dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block">
                    Select Bank Name <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={signupBankName}
                    onChange={(e) => handleBankNameChange(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white text-xs font-mono focus:border-amber-400 focus:outline-none"
                  >
                    {NIGERIAN_BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                {/* Account Number */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider block">
                    10-Digit Account Number <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" />
                    <input
                      type="text"
                      maxLength={10}
                      inputMode="numeric"
                      required
                      value={signupAccountNumber}
                      onChange={handleAccountNumberChange}
                      placeholder="e.g. 9238778409"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white font-mono text-xs focus:border-amber-400 focus:outline-none"
                    />
                  </div>
                </div>

                {/* NUBAN Resolved Account Name Status */}
                {isResolvingNuban && (
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-400/30 text-amber-300 text-[11px] flex items-center gap-2 font-mono">
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-amber-400" />
                    <span>Resolving account details with bank...</span>
                  </div>
                )}

                {nubanResolved && signupAccountName && !isResolvingNuban && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px] flex items-center justify-between font-mono">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <div>
                        <span className="text-[9px] text-neutral-400 block uppercase">Auto-Resolved Account Name</span>
                        <strong className="text-white text-xs tracking-wide">{signupAccountName}</strong>
                      </div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">VERIFIED</span>
                  </div>
                )}

                {nubanError && !isResolvingNuban && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] space-y-1.5 font-mono">
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Account Verification Notice</span>
                    </div>
                    <p className="text-[10px] text-neutral-300 font-sans leading-tight">{nubanError}</p>
                    <div className="pt-1 border-t border-rose-500/20">
                      <label className="text-[9px] text-neutral-400 uppercase tracking-wider block font-sans">
                        Official Legal Account Name:
                      </label>
                      <input
                        type="text"
                        value={signupAccountName}
                        onChange={(e) => setSignupAccountName(e.target.value.toUpperCase())}
                        placeholder="ENTER YOUR FULL LEGAL NAME"
                        className="w-full mt-1 px-2.5 py-1.5 rounded bg-neutral-900 border border-neutral-700 text-white text-xs font-mono uppercase focus:border-amber-400 focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || isResolvingNuban}
                className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 font-black rounded-2xl text-sm transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                {loading ? (
                  <span>Registering Secure Profile...</span>
                ) : (
                  <>
                    <Swords className="w-4 h-4 stroke-[2.5]" />
                    <span>Create CODM Stake Account</span>
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); }}
                  className="text-xs text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Already registered? <span className="text-amber-400 font-bold underline">Sign In instead</span>
                </button>
              </div>
            </form>
          ) : (
            /* ===================== SIGN IN FORM ===================== */
            <form onSubmit={handleSignInSubmit} className="space-y-4">
              {/* Identifier */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Email or CODM Username (IGN) <span className="text-rose-400">*</span></span>
                </label>
                <input
                  type="text"
                  required
                  value={signinIdentifier}
                  onChange={(e) => setSigninIdentifier(e.target.value)}
                  placeholder="e.g. Ghost_NG or ghost@lagos-codm.com"
                  className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                />
              </div>

              {/* Password */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Password <span className="text-rose-400">*</span></span>
                </label>
                <div className="relative">
                  <input
                    type={showSigninPassword ? 'text' : 'password'}
                    required
                    value={signinPassword}
                    onChange={(e) => setSigninPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-4 pr-11 py-3 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-amber-400 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSigninPassword(!showSigninPassword)}
                    className="absolute right-3 top-3 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showSigninPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 font-black rounded-2xl text-sm transition-all shadow-xl cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wide"
              >
                {loading ? (
                  <span>Signing In...</span>
                ) : (
                  <>
                    <span>Sign In to Account</span>
                    <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                  </>
                )}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); }}
                  className="text-xs text-neutral-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  Don't have an account yet? <span className="text-amber-400 font-bold underline">Create one now</span>
                </button>
              </div>

              {/* Quick 1-Click Demo Profiles */}
              {demoUsers && Object.keys(demoUsers).length > 0 && (
                <div className="pt-4 border-t border-neutral-800 space-y-2.5">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider text-center flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Instant 1-Click Demo Profiles</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {Object.values(demoUsers).slice(0, 2).map((user) => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => handleQuickDemoLogin(user)}
                        className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-400/60 transition-all flex items-center justify-between text-left group cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={user.avatar}
                            alt={user.codmIgn}
                            className="w-7 h-7 rounded-lg object-cover bg-neutral-800"
                            referrerPolicy="no-referrer"
                          />
                          <div>
                            <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                              {user.codmIgn}
                            </div>
                            <div className="text-[10px] text-neutral-400 font-mono-nums">
                              ₦{user.balance.toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-neutral-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 max-w-5xl w-full mx-auto text-center pt-6 text-xs text-neutral-500">
        Call of Duty: Mobile Esports Escrow Arena · Minimum Wager ₦100 · 10% Platform Rake
      </div>
    </div>
  );
};
