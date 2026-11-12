import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { Trophy, Medal, Award, Flame, Search, Clock, ChevronRight, Swords, Sparkles, TrendingUp, Shield } from 'lucide-react';
import { useSound } from '../hooks/useSound';

interface LeaderboardPageProps {
  currentUser: UserProfile;
  onNavigate: (tab: string) => void;
  onViewProfile?: (userId: string) => void;
}

interface LeaderboardEntry {
  id: string;
  ign: string;
  tier: string;
  clan: string;
  avatar: string;
  wins: number;
  losses: number;
  winnings: number;
  win_rate: number;
}

export const LeaderboardPage: React.FC<LeaderboardPageProps> = ({
  currentUser,
  onNavigate,
  onViewProfile,
}) => {
  const [season, setSeason] = useState<'weekly' | 'all'>('weekly');
  const [category, setCategory] = useState<'wins' | 'winnings' | 'win_rate'>('wins');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({ days: 2, hours: 14, minutes: 35, seconds: 42 });
  const playSound = useSound();

  // Fetch Leaderboard data
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetch(`/api/leaderboard?season=${season}`)
      .then(res => res.json())
      .then(data => {
        if (isMounted && Array.isArray(data)) {
          setEntries(data);
        }
      })
      .catch(err => console.error("Error fetching leaderboard:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => { isMounted = false; };
  }, [season]);

  // Weekly reset countdown timer calculation (resets every Sunday at midnight)
  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const result = new Date(now);
      // Find next Sunday 00:00:00
      result.setDate(now.getDate() + ((7 - now.getDay()) % 7 || 7));
      result.setHours(0, 0, 0, 0);

      const diff = result.getTime() - now.getTime();
      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sort entries based on selected category
  const sortedEntries = [...entries].sort((a, b) => {
    if (category === 'wins') {
      return b.wins - a.wins || b.winnings - a.winnings;
    } else if (category === 'winnings') {
      return b.winnings - a.winnings || b.wins - a.wins;
    } else {
      return b.win_rate - a.win_rate || b.wins - a.wins;
    }
  });

  // Filter by search query
  const filteredEntries = sortedEntries.filter(entry => 
    entry.ign.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.clan.toLowerCase().includes(searchQuery.toLowerCase()) ||
    entry.tier.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const top3 = filteredEntries.slice(0, 3);
  const restOfList = filteredEntries.slice(3);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-24">
      
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-amber-950/40 border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5" />
              <span>Official Esports Hall of Fame</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-heading font-black text-white tracking-wide uppercase">
              Gladiator Leaderboards
            </h1>
            <p className="text-sm text-neutral-400 max-w-xl">
              Rank among elite Call of Duty Mobile warriors. Dominate the weekly season for glory, badge upgrades, and high stakes cash rewards.
            </p>
          </div>

          {/* Weekly Reset Countdown Timer Card */}
          <div className="bg-neutral-950/80 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex items-center gap-4 shadow-xl backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                {season === 'weekly' ? 'Weekly Reset In' : 'Season Active'}
              </div>
              <div className="font-mono font-black text-white text-base sm:text-lg flex items-center gap-1">
                <span>{timeLeft.days}d</span>:
                <span>{String(timeLeft.hours).padStart(2, '0')}h</span>:
                <span>{String(timeLeft.minutes).padStart(2, '0')}m</span>:
                <span className="text-amber-400">{String(timeLeft.seconds).padStart(2, '0')}s</span>
              </div>
            </div>
          </div>
        </div>

        {/* Season Toggle & Category Tabs */}
        <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-6 border-t border-neutral-800/80">
          
          {/* Season Toggle */}
          <div className="flex items-center bg-neutral-950 p-1.5 rounded-2xl border border-neutral-800">
            <button
              onClick={() => { playSound(); setSeason('weekly'); }}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                season === 'weekly'
                  ? 'bg-amber-400 text-neutral-950 shadow-lg shadow-amber-400/20'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Weekly Season</span>
            </button>
            <button
              onClick={() => { playSound(); setSeason('all'); }}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
                season === 'all'
                  ? 'bg-amber-400 text-neutral-950 shadow-lg shadow-amber-400/20'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>All-Time Hall of Fame</span>
            </button>
          </div>

          {/* Metric Filter Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => { playSound(); setCategory('wins'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border ${
                category === 'wins'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/50 shadow'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              Total Wins
            </button>
            <button
              onClick={() => { playSound(); setCategory('winnings'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border ${
                category === 'winnings'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/50 shadow'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              High Stakes Earned
            </button>
            <button
              onClick={() => { playSound(); setCategory('win_rate'); }}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border ${
                category === 'win_rate'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-400/50 shadow'
                  : 'bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              Win Rate %
            </button>
          </div>

        </div>
      </div>

      {/* Search Filter */}
      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        <input
          type="text"
          placeholder="Search gladiator IGN, clan, or tier..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 transition-colors"
        />
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-mono text-neutral-400">Loading elite gladiator rankings...</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-12 text-center space-y-4">
          <Trophy className="w-12 h-12 text-neutral-600 mx-auto" />
          <h3 className="font-heading font-black text-lg text-white uppercase">No Gladiators Found</h3>
          <p className="text-xs text-neutral-400 max-w-md mx-auto">
            No rankings match your search criteria. Be the first to settle matches and climb the leaderboard!
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium Cards */}
          {top3.length > 0 && searchQuery === '' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
              {top3.map((entry, index) => {
                const rank = index + 1;
                const isFirst = rank === 1;
                const isSecond = rank === 2;
                const isThird = rank === 3;

                return (
                  <div
                    key={entry.id}
                    className={`relative rounded-3xl p-6 border flex flex-col items-center text-center transition-transform hover:scale-[1.02] shadow-2xl ${
                      isFirst
                        ? 'bg-gradient-to-b from-amber-500/20 via-neutral-900 to-neutral-950 border-amber-400 ring-2 ring-amber-400/30'
                        : isSecond
                        ? 'bg-gradient-to-b from-slate-400/20 via-neutral-900 to-neutral-950 border-slate-400'
                        : 'bg-gradient-to-b from-amber-700/20 via-neutral-900 to-neutral-950 border-amber-700/60'
                    }`}
                  >
                    {/* Rank Badge */}
                    <div className={`absolute -top-4 w-10 h-10 rounded-2xl flex items-center justify-center font-heading font-black text-sm shadow-lg ${
                      isFirst ? 'bg-amber-400 text-neutral-950' : isSecond ? 'bg-slate-300 text-neutral-950' : 'bg-amber-700 text-white'
                    }`}>
                      {isFirst ? '👑 1' : isSecond ? '🥈 2' : '🥉 3'}
                    </div>

                    <img
                      src={entry.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(entry.ign)}`}
                      alt={entry.ign}
                      className="w-20 h-20 rounded-2xl object-cover bg-neutral-800 border-2 border-neutral-700 mt-4 mb-3 shadow-md"
                      referrerPolicy="no-referrer"
                    />

                    <div className="font-heading font-black text-lg text-white uppercase tracking-wide">
                      {entry.ign}
                    </div>
                    <div className="text-[11px] font-mono text-amber-400 font-bold mb-3">
                      {entry.clan} • {entry.tier}
                    </div>

                    {/* Stats Grid */}
                    <div className="w-full grid grid-cols-3 gap-2 py-3 px-4 bg-neutral-950/80 rounded-2xl border border-neutral-800/80 my-2">
                      <div>
                        <div className="text-[10px] font-mono text-neutral-500 uppercase">Wins</div>
                        <div className="font-mono font-black text-white text-sm">{entry.wins}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-neutral-500 uppercase">Win Rate</div>
                        <div className="font-mono font-black text-emerald-400 text-sm">{entry.win_rate}%</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-mono text-neutral-500 uppercase">Winnings</div>
                        <div className="font-mono font-black text-amber-400 text-xs sm:text-sm">₦{entry.winnings.toLocaleString()}</div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        playSound();
                        if (onViewProfile) onViewProfile(entry.id);
                        else onNavigate('social');
                      }}
                      className="mt-3 w-full py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>View Profile</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Remaining Rankings List */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 bg-neutral-900 border-b border-neutral-800 font-heading font-black text-xs text-neutral-400 uppercase tracking-widest grid grid-cols-12 gap-4 items-center">
              <div className="col-span-2 sm:col-span-1 text-center">Rank</div>
              <div className="col-span-6 sm:col-span-5">Gladiator</div>
              <div className="hidden sm:block sm:col-span-2 text-center">Wins / Losses</div>
              <div className="col-span-2 sm:col-span-2 text-center">Win Rate</div>
              <div className="col-span-2 sm:col-span-2 text-right">Total Winnings</div>
            </div>

            <div className="divide-y divide-neutral-800/80">
              {(searchQuery !== '' ? filteredEntries : restOfList).map((entry, idx) => {
                const actualRank = searchQuery !== '' ? idx + 1 : idx + 4;

                return (
                  <div
                    key={entry.id}
                    className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-neutral-800/30 transition-colors cursor-pointer"
                    onClick={() => {
                      playSound();
                      if (onViewProfile) onViewProfile(entry.id);
                      else onNavigate('social');
                    }}
                  >
                    <div className="col-span-2 sm:col-span-1 text-center font-mono font-black text-neutral-400 text-sm">
                      #{actualRank}
                    </div>

                    <div className="col-span-6 sm:col-span-5 flex items-center gap-3">
                      <img
                        src={entry.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(entry.ign)}`}
                        alt={entry.ign}
                        className="w-10 h-10 rounded-xl object-cover bg-neutral-800 border border-neutral-700"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="font-heading font-black text-sm text-white uppercase hover:text-amber-400 transition-colors">
                          {entry.ign}
                        </div>
                        <div className="text-[10px] font-mono text-neutral-400">
                          {entry.clan} • <span className="text-amber-400">{entry.tier}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden sm:block sm:col-span-2 text-center font-mono text-xs text-neutral-300">
                      <span className="text-emerald-400 font-bold">{entry.wins}W</span> / <span className="text-rose-400">{entry.losses}L</span>
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-center font-mono font-bold text-xs text-emerald-400">
                      {entry.win_rate}%
                    </div>

                    <div className="col-span-2 sm:col-span-2 text-right font-mono font-black text-amber-400 text-xs sm:text-sm">
                      ₦{entry.winnings.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
