import React from 'react';
import { UserProfile } from '../types';
import { Swords, Trophy, ShieldCheck, Clock, User } from 'lucide-react';

interface BottomNavbarProps {
  currentUser: UserProfile;
  currentTab: string;
  onNavigate: (tab: string) => void;
}

export const BottomNavbar: React.FC<BottomNavbarProps> = ({
  currentUser,
  currentTab,
  onNavigate,
}) => {
  const navItems = [
    {
      id: 'arena',
      label: 'Arena',
      icon: Swords,
    },
    {
      id: 'rules',
      label: 'Rules',
      icon: ShieldCheck,
    },
    {
      id: 'history',
      label: 'History',
      icon: Clock,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: User,
    },
  ];

  return (
    <nav
      aria-label="App Navigation"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[calc(100%-1.5rem)] sm:w-auto"
    >
      <div className="flex items-center justify-around sm:justify-center gap-1 sm:gap-3 px-3 py-2 rounded-2xl bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 shadow-2xl shadow-black/90 ring-1 ring-white/5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 sm:px-4 rounded-xl transition-all duration-200 cursor-pointer group ${
                isActive
                  ? 'bg-amber-400/15 text-amber-400 border border-amber-500/40 shadow-md shadow-amber-500/10'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
              title={item.label}
            >
              <Icon
                className={`w-4 h-4 sm:w-5 sm:h-5 transition-transform duration-200 group-hover:scale-110 ${
                  isActive ? 'text-amber-400 stroke-[2.5]' : 'text-neutral-400'
                }`}
              />
              <span className={`text-[9px] sm:text-[10px] font-bold tracking-tight mt-0.5 font-heading uppercase ${
                isActive ? 'text-amber-400' : 'text-neutral-400'
              }`}>
                {item.label}
              </span>

              {/* Active glow indicator */}
              {isActive && (
                <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
