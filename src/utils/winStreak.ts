import { Match } from '../types';

export type RecentMatchOutcome = 'W' | 'L' | 'D';

export interface WinStreakStats {
  streak: number;
  winsInLast5: number;
  recentResults: RecentMatchOutcome[];
  isHotStreak: boolean;
}

export function calculateLast5WinStreak(userId: string | undefined, matches: Match[]): WinStreakStats {
  if (!userId || userId === 'guest' || !Array.isArray(matches) || matches.length === 0) {
    return {
      streak: 0,
      winsInLast5: 0,
      recentResults: [],
      isHotStreak: false,
    };
  }

  const settledUserMatches = matches
    .filter((m) => {
      if (m.status !== 'SETTLED' && m.status !== 'ABANDONED_AND_SETTLED') return false;
      const isCreator = m.creator?.id === userId;
      const isOpponent = m.opponent?.id === userId;
      const isSquadPlayer = Boolean(m.squadData?.slots?.some((s) => s.userId === userId && s.staked));
      return isCreator || isOpponent || isSquadPlayer;
    })
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 5);

  const recentResults: RecentMatchOutcome[] = settledUserMatches.map((m) => {
    const isDraw = !m.winnerId || Boolean(m.winnerIgn?.toUpperCase().includes('DRAW'));
    if (isDraw) return 'D';

    const isSquad = m.matchType === 'squad' || Boolean(m.squadData);
    if (isSquad) {
      const userSlot = m.squadData?.slots?.find((s) => s.userId === userId && s.staked);
      const wonSquad =
        m.winnerId === userId ||
        Boolean(userSlot && (m.winnerId === userSlot.team || m.squadData?.winningTeam === userSlot.team));
      return wonSquad ? 'W' : 'L';
    }

    return m.winnerId === userId ? 'W' : 'L';
  });

  let streak = 0;
  for (const outcome of recentResults) {
    if (outcome === 'W') {
      streak += 1;
    } else {
      break;
    }
  }

  const winsInLast5 = recentResults.filter((r) => r === 'W').length;

  return {
    streak,
    winsInLast5,
    recentResults,
    isHotStreak: streak >= 2,
  };
}
