import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Users, Copy, ArrowLeft, Zap, Trophy, ShieldCheck, Gift, Check, Share2, TrendingUp } from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';

interface ReferralPageProps {
  currentUser: UserProfile;
  onNavigateBack: () => void;
}

export const ReferralPage: React.FC<ReferralPageProps> = ({ currentUser, onNavigateBack }) => {
  const [copied, setCopied] = useState(false);
  const referralLink = `${window.location.origin}/?ref=${currentUser.referralCode || currentUser.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-20 pt-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
      <button
        onClick={onNavigateBack}
        className="group flex items-center gap-3 text-neutral-500 hover:text-white text-xs font-black uppercase tracking-[0.2em] transition-all mb-4"
      >
        <div className="w-8 h-8 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center group-hover:border-amber-400 transition-colors">
          <ArrowLeft size={16} />
        </div>
        Back to Profile
      </button>

      {/* 1. HERO RECRUITMENT CARD */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-neutral-900 border-2 border-blue-500/40 p-8 sm:p-12 shadow-2xl group">
        <div className="absolute inset-0 z-0 opacity-10 group-hover:opacity-20 transition-opacity duration-700 pointer-events-none">
          <img src={CODM_IMAGES.cardBgSubtle} alt="" className="w-full h-full object-cover grayscale" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-transparent to-black/80" />
        </div>
        
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-500/15 rounded-full blur-[100px] animate-pulse" />

        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
          <div className="space-y-6 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4">
               <div className="w-16 h-16 rounded-[1.5rem] bg-blue-500/10 border-2 border-blue-400 flex items-center justify-center text-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                 <Users size={32} />
               </div>
               <div>
                 <h1 className="font-heading font-black text-4xl sm:text-5xl text-white tracking-tighter uppercase leading-none">
                   Recruitment HQ
                 </h1>
                 <p className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-2 justify-center lg:justify-start">
                   <Gift size={14} /> Passive Income Protocol Active
                 </p>
               </div>
            </div>
            <p className="text-neutral-500 text-sm max-w-lg font-medium leading-relaxed">
              Expand the OPS STAKE legion. Earn <span className="text-white font-bold">10% of platform fees</span> for every wager your recruits deploy. Lifetime synchronization.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
             <div className="p-6 rounded-2xl bg-black/40 border border-neutral-800 backdrop-blur-md flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em]">Recruits</span>
                <span className="text-3xl font-black text-white font-mono-nums">{currentUser.totalReferralEarnings ? (Math.floor(currentUser.totalReferralEarnings / 100)) : 0}</span>
             </div>
             <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] text-emerald-500/60 font-black uppercase tracking-[0.2em]">Earnings</span>
                <span className="text-3xl font-black text-emerald-400 font-mono-nums">₦{(currentUser.totalReferralEarnings || 0).toLocaleString()}</span>
             </div>
          </div>
        </div>
      </div>

      {/* 2. LINK GENERATOR */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-blue-400 pointer-events-none group-hover:opacity-5 transition-opacity duration-700">
              <Share2 size={160} />
            </div>

            <div className="space-y-2 relative z-10">
               <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Deployment Link</h3>
               <p className="text-neutral-500 text-xs font-medium">Distribute your unique handshake URL to new gladiators.</p>
            </div>

            <div className="space-y-4 relative z-10">
               <div className="p-2 bg-black/60 rounded-[1.5rem] border border-neutral-800 flex flex-col sm:flex-row items-center gap-2 group-focus-within:border-blue-500/50 transition-all">
                  <div className="flex-1 px-6 py-4 text-neutral-400 font-mono text-sm truncate w-full">
                    {referralLink}
                  </div>
                  <button 
                    onClick={handleCopy}
                    className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-3 ${copied ? 'bg-emerald-500 text-black' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/10'}`}
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                    {copied ? 'COPIED' : 'COPY LINK'}
                  </button>
               </div>

               <div className="flex flex-wrap gap-3">
                  <div className="px-4 py-2 rounded-xl bg-neutral-800/50 border border-neutral-700/50 text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-400" />
                    AES-256 Encrypted
                  </div>
                  <div className="px-4 py-2 rounded-xl bg-neutral-800/50 border border-neutral-700/50 text-[10px] font-black text-neutral-500 uppercase tracking-widest flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-400" />
                    Unlimited Scaling
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 shadow-2xl flex flex-col justify-center space-y-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-50" />
            <div className="relative z-10 text-center space-y-4">
               <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                 <Zap size={32} className="animate-pulse" />
               </div>
               <div className="space-y-1">
                 <h4 className="text-xl font-black text-white uppercase tracking-tighter">Tier 1 Payouts</h4>
                 <p className="text-xs text-neutral-500 font-medium">Automatic balance credit upon recruit wager settlement.</p>
               </div>
               <div className="pt-2">
                 <span className="text-4xl font-black text-amber-400 font-mono tracking-tighter">10%</span>
                 <p className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.2em] mt-1">Platform Rake Share</p>
               </div>
            </div>
         </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section className="bg-neutral-950/50 border border-neutral-900 rounded-[3rem] p-10">
         <h3 className="text-center text-[10px] font-black text-neutral-600 uppercase tracking-[0.4em] mb-12">Recruitment Protocol</h3>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { step: '01', label: 'SHARE SIGNAL', desc: 'Deploy your recruitment link across social sectors and gaming communities.', icon: Share2 },
              { step: '02', label: 'SYNC RECRUIT', desc: 'Gladiators who register using your link are permanently tethered to your ID.', icon: Zap },
              { step: '03', label: 'COLLECT TRIBUTE', desc: 'Receive instant cash credits whenever they battle in the arena.', icon: Trophy },
            ].map((item, idx) => (
              <div key={idx} className="relative space-y-4 text-center group">
                 <div className="text-5xl font-black text-neutral-900 absolute -top-8 left-1/2 -translate-x-1/2 select-none group-hover:text-blue-500/10 transition-colors duration-500">{item.step}</div>
                 <div className="w-14 h-14 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400 mx-auto group-hover:text-white group-hover:border-neutral-700 transition-all relative z-10">
                   <item.icon size={24} />
                 </div>
                 <div className="space-y-1 relative z-10">
                    <h5 className="font-black text-white uppercase tracking-widest text-sm">{item.label}</h5>
                    <p className="text-neutral-500 text-xs leading-relaxed max-w-[200px] mx-auto">{item.desc}</p>
                 </div>
              </div>
            ))}
         </div>
      </section>
    </div>
  );
};

