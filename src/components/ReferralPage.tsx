import React from 'react';
import { UserProfile } from '../types';
import { Users, Copy, ArrowLeft } from 'lucide-react';

interface ReferralPageProps {
  currentUser: UserProfile;
  onNavigateBack: () => void;
}

export const ReferralPage: React.FC<ReferralPageProps> = ({ currentUser, onNavigateBack }) => {
  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16 pt-8">
      <button
        onClick={onNavigateBack}
        className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm font-bold transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Profile
      </button>

      <div className="p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6">
        <div className="flex items-center gap-3 text-emerald-400 mb-6">
          <Users className="w-8 h-8" />
          <h1 className="font-heading font-black text-3xl text-white uppercase tracking-wide">
            Referral Program
          </h1>
        </div>

        <p className="text-neutral-400 text-sm">
          Earn 10% of platform fees for every bet your referrals place, for life. Share your unique link below.
        </p>

        <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4">
          <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block font-mono">
            Your Unique Referral Link
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={`${window.location.origin}/?ref=${currentUser.referralCode}`}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white font-mono"
            />
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/?ref=${currentUser.referralCode}`)}
              className="p-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
            >
              <Copy className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 text-center space-y-1">
            <div className="text-xs text-neutral-400 uppercase font-mono">Total Referrals</div>
            <div className="text-3xl font-black text-white font-mono-nums">{currentUser.referralCount || 0}</div>
          </div>
          <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 text-center space-y-1">
            <div className="text-xs text-emerald-400 uppercase font-mono">Total Earnings</div>
            <div className="text-3xl font-black text-emerald-400 font-mono-nums">₦{(currentUser.totalReferralEarnings || 0).toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
