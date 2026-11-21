import React from 'react';
import { Flame } from 'lucide-react';
import { WinStreakStats } from '../utils/winStreak';

interface WinStreakBadgeProps {
  stats: WinStreakStats;
  variant?: 'profile' | 'card';
  showFormDots?: boolean;
}

export const WinStreakBadge: React.FC<WinStreakBadgeProps> = ({
  stats,
  variant = 'card',
  showFormDots = false,
}) => {
  const { streak, recentResults, isHotStreak } = stats;

  const badgeTone =
    streak >= 3
      ? 'bg-gradient-to-r from-orange-500/20 via-amber-500/20 to-rose-500/20 border-orange-400/50 text-amber-300 shadow-sm shadow-orange-500/15'
      : streak >= 1
      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
      : 'bg-neutral-800/80 border-neutral-700 text-neutral-400';

  const flameTone =
    streak >= 3
      ? 'text-orange-400 animate-pulse'
      : streak >= 1
      ? 'text-emerald-400'
      : 'text-neutral-500';

  const tooltip =
    recentResults.length > 0
      ? `Win Streak: ${streak} (Last ${recentResults.length}: ${recentResults.join(' · ')})`
      : 'Win Streak: 0 (Play & win matches to ignite a streak!)';

  if (variant === 'profile') {
    return (
      <div
        title={tooltip}
        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider transition-all ${badgeTone}`}
      >
        <Flame size={14} className={`shrink-0 ${flameTone}`} />
        <span>
          {streak > 0 ? `${streak} Win Streak` : '0 Win Streak'}
        </span>
        {isHotStreak && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-orange-500/25 text-orange-200 border border-orange-400/30">
            HOT
          </span>
        )}
        {showFormDots && recentResults.length > 0 && (
          <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-white/10">
            {recentResults.map((res, idx) => (
              <span
                key={idx}
                className={`w-3.5 h-3.5 rounded-full text-[8px] font-mono font-black flex items-center justify-center ${
                  res === 'W'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                    : res === 'D'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                    : 'bg-rose-500/30 text-rose-300 border border-rose-400/40'
                }`}
              >
                {res}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider shrink-0 whitespace-nowrap ${badgeTone}`}
    >
      <Flame size={11} className={`shrink-0 ${flameTone}`} />
      <span>{streak} Win Streak</span>
    </span>
  );
};
