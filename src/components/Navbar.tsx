import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  Menu, X, Swords, CreditCard, ShieldCheck, Clock,
  User, Trophy, Plus, LogOut, ChevronRight, Wallet,
  Crosshair, ArrowRight, Bell, ShieldAlert, Headphones, Users as UsersIcon
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { useSound } from '../hooks/useSound';
import { Logo } from './Logo';

export interface NavbarProps {
  currentUser: UserProfile;
  currentTab: string;
  onNavigate: (tab: string) => void;
  openCreateBetModal: () => void;
  onOpenFundWallet?: () => void;
  onSignOut?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotificationCenter?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentTab,
  onNavigate,
  openCreateBetModal,
  onOpenFundWallet,
  onSignOut,
  unreadNotificationsCount = 0,
  onOpenNotificationCenter,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const playTabSound = useSound();

  // Close menu when pressing Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Prevent background scrolling when menu drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const navTabs = [
    {
      id: 'arena',
      label: 'Arena',
      subtitle: '1v1 Wagering & Active Battles',
      icon: Swords,
      badge: 'LIVE',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    },
    {
      id: 'wallet',
      label: 'Wallet & Payouts',
      subtitle: `₦${currentUser.balance.toLocaleString()} Available`,
      icon: CreditCard,
      badge: '₦',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    },
    {
      id: 'rules',
      label: 'Match Rules',
      subtitle: 'Escrow Terms & Fair Play System',
      icon: ShieldCheck,
      badge: 'TERMS',
      badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
    },
    {
      id: 'history',
      label: 'Match History',
      subtitle: 'Settled Duels & AI Verification',
      icon: Clock,
      badge: `${currentUser.wins}W-${currentUser.losses}L`,
      badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
    },
    {
      id: 'profile',
      label: 'Player Profile',
      subtitle: 'IGN, Credentials & Audio FX',
      icon: User,
      badge: 'LVL 150',
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    },
    {
      id: 'social',
      label: 'Rivals & Chat',
      subtitle: 'Friend Requests & 1v1 Challenges',
      icon: UsersIcon,
      badge: 'NEW',
      badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40',
    },
    {
      id: 'disputes',
      label: 'Dispute Resolution',
      subtitle: 'Video Proof & Referee Queue',
      icon: ShieldAlert,
      badge: 'ESCROW',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    },
    {
      id: 'referrals',
      label: 'Referral Rewards',
      subtitle: 'Earn ₦1,000 per Active Rival',
      icon: Trophy,
      badge: 'EARN',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    },
    {
      id: 'support',
      label: 'Live Customer Support',
      subtitle: '24/7 Admin & Referee Chat Assistance',
      icon: Headphones,
      badge: 'ONLINE',
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    },
  ];

  if (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator') {
    navTabs.push({
      id: 'admin',
      label: 'Admin Portal',
      subtitle: 'Platform Fees & Gladiators',
      icon: ShieldCheck,
      badge: 'ADMIN',
      badgeColor: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
    });
  }

  const handleSelectTab = (tabId: string) => {
    playTabSound();
    if (tabId === 'support') {
      window.dispatchEvent(new CustomEvent('open-support-widget'));
      setIsMenuOpen(false);
      return;
    }
    onNavigate(tabId);
    setIsMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo & Wordmark */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('landing')}
              className="flex items-center gap-2.5 group text-left focus:outline-none cursor-pointer"
              title="Go to Home / Landing Page"
            >
              <Logo size={40} />
              <div>
                <span className="font-heading font-black text-lg sm:text-xl tracking-wider text-white group-hover:text-amber-400 transition-colors">
                  OPS STAKE
                </span>
              </div>
            </button>
          </div>

          {/* Quick HUD & 3-line Corner Menu Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Wallet Balance & Top-Up Button */}
            <button
              onClick={onOpenFundWallet || (() => handleSelectTab('wallet'))}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-400/50 transition-all cursor-pointer group"
              title="Wallet Balance - Click to top up"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono font-bold text-xs text-neutral-200 group-hover:text-white transition-colors">
                ₦{currentUser.balance.toLocaleString()}
              </span>
              <span className="text-[10px] font-black text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30 uppercase tracking-wide">
                + Top Up
              </span>
            </button>

            {/* Quick Create Bet Button */}
            <button
              onClick={openCreateBetModal}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-black text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-md transition-all active:scale-95 whitespace-nowrap cursor-pointer uppercase"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span className="hidden xs:inline">Create Bet</span>
              <span className="xs:hidden">Bet</span>
            </button>

            {/* User Mini Avatar Badge */}
            <button
              onClick={() => handleSelectTab('profile')}
              className={`flex items-center gap-2 p-1.5 rounded-xl border transition-all cursor-pointer text-left ${
                currentTab === 'profile'
                  ? 'bg-amber-500/15 border-amber-400'
                  : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'
              }`}
              title="View Player Profile"
            >
              <img
                src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.codmIgn)}`}
                alt={currentUser.codmIgn}
                className="w-7 h-7 rounded-lg object-cover bg-neutral-800"
                referrerPolicy="no-referrer"
              />
              <div className="hidden md:block text-left pr-1">
                <div className="font-bold text-white text-xs leading-tight">{currentUser.codmIgn}</div>
              </div>
            </button>

            {/* Live Customer Support Button */}
            <button
              type="button"
              onClick={() => {
                playTabSound();
                window.dispatchEvent(new CustomEvent('open-support-widget'));
              }}
              className="relative p-2 sm:p-2.5 rounded-xl border border-neutral-800 hover:border-amber-400/50 bg-neutral-900 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center"
              title="24/7 Live Customer Support Chat"
              aria-label="Customer Support"
            >
              <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-neutral-950 animate-pulse" />
            </button>

            {/* Live Match Alerts Bell Button */}
            <button
              type="button"
              onClick={onOpenNotificationCenter}
              className="relative p-2 sm:p-2.5 rounded-xl border border-neutral-800 hover:border-amber-400/50 bg-neutral-900 text-neutral-300 hover:text-white transition-all cursor-pointer shadow-md active:scale-95 flex items-center justify-center"
              title="Live Match Alerts & Mobile Phone Notifications"
              aria-label="Live Match Alerts"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              {(unreadNotificationsCount || 0) > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-amber-500 text-neutral-950 font-black text-[10px] rounded-full flex items-center justify-center ring-2 ring-neutral-950 animate-pulse">
                  {(unreadNotificationsCount || 0) > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {/* 3-Line Hamburger Menu Button at the Top Corner */}
            <button
              type="button"
              onClick={() => {
                playTabSound();
                setIsMenuOpen(!isMenuOpen);
              }}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-lg active:scale-95 ${
                isMenuOpen
                  ? 'bg-amber-400 text-neutral-950 border-amber-300 shadow-amber-400/20'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 hover:border-amber-400 text-neutral-200 hover:text-amber-400'
              }`}
              aria-label="Navigation Menu"
              title="Open Navigation Menu"
            >
              {isMenuOpen ? (
                <X className="w-5 h-5 stroke-[2.5]" />
              ) : (
                <Menu className="w-5 h-5 stroke-[2.5]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* 3-LINE MENU SLIDE-OUT DRAWER / MODAL                          */}
      {/* ------------------------------------------------------------- */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop blur overlay */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over panel from top-right corner */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-sm sm:max-w-md bg-neutral-950 border-l border-neutral-800 shadow-2xl flex flex-col justify-between overflow-y-auto">
              
              {/* Drawer Header */}
              <div className="p-5 border-b border-neutral-800/80 bg-neutral-900/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center font-black">
                    <Crosshair className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-heading font-black text-sm text-white uppercase tracking-wider">
                      OPS Stake Hub
                    </h2>
                    <p className="text-[10px] text-neutral-400 font-mono">
                      All Navigation Tabs & Operations
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 transition-colors cursor-pointer"
                  title="Close Menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Player Quick Info Header */}
              <div className="p-5 bg-neutral-900/30 border-b border-neutral-800/60">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.codmIgn)}`}
                      alt={currentUser.codmIgn}
                      className="w-11 h-11 rounded-xl object-cover border border-amber-500/50 bg-neutral-800"
                      referrerPolicy="no-referrer"
                    />
                    <div>
                      <div className="font-heading font-black text-sm text-white uppercase">
                        {currentUser.codmIgn}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">
                        UID: {currentUser.codmUid}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] text-neutral-400 font-mono uppercase">Balance</div>
                    <div className="font-mono font-black text-sm text-amber-400">
                      ₦{currentUser.balance.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* All Navigation Tab Items */}
              <div className="flex-1 p-4 sm:p-5 space-y-2 overflow-y-auto">
                <div className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider px-2 py-1">
                  MAIN NAVIGATION
                </div>

                {/* Live Match Alerts in Drawer */}
                <button
                  onClick={() => {
                    playTabSound();
                    setIsMenuOpen(false);
                    onOpenNotificationCenter?.();
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl transition-all cursor-pointer text-left border bg-neutral-900/70 hover:bg-neutral-900 border-neutral-800/80 hover:border-amber-400/50 group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                      <Bell className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div>
                      <div className="font-heading font-black text-sm uppercase tracking-wide text-white group-hover:text-amber-400 flex items-center gap-2">
                        <span>Match Alerts</span>
                        {(unreadNotificationsCount || 0) > 0 && (
                          <span className="bg-amber-500 text-neutral-950 font-black text-[10px] px-1.5 py-0.5 rounded-full">
                            {unreadNotificationsCount} NEW
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-400">Mobile lock-screen & browser alerts</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-500 group-hover:text-amber-400 transition-colors" />
                </button>

                {navTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleSelectTab(tab.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-sm transition-all cursor-pointer text-left border ${
                        isActive
                          ? 'bg-neutral-800 border-l-4 border-l-amber-500'
                          : 'bg-neutral-900/50 hover:bg-neutral-800 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1 ${isActive ? 'text-amber-500' : 'text-neutral-400'}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className={`font-black text-sm uppercase tracking-wider ${
                            isActive ? 'text-white' : 'text-neutral-300'
                        }`}>
                          {tab.label}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-5 border-t border-neutral-800 bg-neutral-900/60 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      if (onOpenFundWallet) onOpenFundWallet();
                      else handleSelectTab('wallet');
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-white text-xs font-bold font-mono uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Wallet className="w-3.5 h-3.5 text-amber-400" />
                    <span>Top Up</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      openCreateBetModal();
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Create Bet</span>
                  </button>
                </div>

                {onSignOut && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 hover:text-rose-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out of Account</span>
                  </button>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
};
