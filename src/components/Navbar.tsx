import React from 'react';
import { UserProfile } from '../types';
import { Swords, Plus, Target, LogOut, Clock, User, Trophy, BookOpen, ShieldCheck } from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';

export interface NavbarProps {
  currentUser: UserProfile;
  currentTab: string;
  onNavigate: (tab: string) => void;
  openCreateBetModal: () => void;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentTab,
  onNavigate,
  openCreateBetModal,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element brand wordmark with Official Logo Emblem */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('arena')}
            className="flex items-center gap-2.5 group text-left focus:outline-none cursor-pointer"
          >
            <img
              src={CODM_IMAGES.appLogo}
              alt="CODM Stake"
              className="w-10 h-10 object-contain group-hover:scale-105 transition-transform drop-shadow-md"
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.target as HTMLImageElement).src = CODM_IMAGES.appLogoFallback;
              }}
            />
            <div>
              <span className="font-heading font-black text-lg sm:text-xl tracking-wider text-white group-hover:text-amber-400 transition-colors">
                CODM STAKE
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Separate Tab Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium">
          <button
            onClick={() => onNavigate('arena')}
            className={`transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'arena' ? 'text-amber-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Arena</span>
          </button>

          <button
            onClick={() => onNavigate('rules')}
            className={`transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'rules' ? 'text-amber-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Rules</span>
          </button>

          <button
            onClick={() => onNavigate('history')}
            className={`transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'history' ? 'text-amber-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>History</span>
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className={`transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'profile' ? 'text-amber-400 font-bold' : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
        </nav>

        {/* Zone 3: Primary Actions & User HUD */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Create Bet Button */}
          <button
            onClick={openCreateBetModal}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-black text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer uppercase"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="hidden xs:inline">Create Bet</span>
            <span className="xs:hidden">Bet</span>
          </button>

          {/* User Profile Badge (Clickable to open profile) */}
          <button
            onClick={() => onNavigate('profile')}
            className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer text-left ${
              currentTab === 'profile'
                ? 'bg-amber-500/15 border-amber-400'
                : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
            }`}
            title="View Player Profile"
          >
            <img
              src={currentUser.avatar}
              alt={currentUser.codmIgn}
              className="w-7 h-7 rounded-lg object-cover bg-neutral-800"
              referrerPolicy="no-referrer"
            />
            <div className="hidden sm:block text-left pr-1">
              <div className="font-bold text-white text-xs leading-tight">{currentUser.codmIgn}</div>
              <div className="text-[10px] text-neutral-400 font-mono-nums">UID: {currentUser.codmUid}</div>
            </div>
          </button>

          {/* Sign Out Button */}
          {onSignOut && (
            <button
              onClick={onSignOut}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-rose-500/50 text-neutral-400 hover:text-rose-400 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
