import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { UserProfile } from '../types';
import { searchFriends, sendFriendRequest, handleFriendAction, fetchFriends } from '../services/api';
import {
  Search, UserPlus, Check, X, MessageCircle, Trophy, Users, Shield,
  Clock, Crosshair, ArrowRight, Loader2, UserCheck, Flame, Target, Bell
} from 'lucide-react';
import { RivalChat } from './RivalChat';
import { requestNotificationPermission, getNotificationPermission } from '../services/notificationService';

interface SocialTabProps {
  currentUser: UserProfile;
  onOpenCreateBet: (mode?: string, stake?: number, rivalId?: string) => void;
  onSyncAppState?: () => Promise<void> | void;
}

export const SocialTab: React.FC<SocialTabProps> = ({ currentUser, onOpenCreateBet, onSyncAppState }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedRival, setSelectedRival] = useState<any>(null);
  const [openChallengeInChat, setOpenChallengeInChat] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadFriends();

    if (!currentUser.id || currentUser.id === 'guest') return;

    const s = io('/');
    const userUpdateEvent = `friend_update_${currentUser.id}`;
    
    s.on(userUpdateEvent, () => {
      loadFriends();
    });

    s.on('rivalNotification', (data: any) => {
      if (data && data.targetUserId === currentUser.id) {
        loadFriends();
      }
    });

    return () => {
      s.off(userUpdateEvent);
      s.off('rivalNotification');
      s.disconnect();
    };
  }, [currentUser.id]);

  const loadFriends = async () => {
    try {
      const data = await fetchFriends(currentUser.id);
      const list = Array.isArray(data) ? data : [];
      setFriends(list);

      // Deep link support for chat notifications
      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get('chat');
        if (chatId) {
          const matched = list.find((f) => f.id === chatId);
          if (matched) {
            setSelectedRival(matched);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load rivals roster:', e);
    }
  };

  const executeSearch = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const results = await searchFriends(trimmed, currentUser.id);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    executeSearch(searchTerm);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    if (!val.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val);
    }, 350);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const requestFriend = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    // Ask for push notification permission if not yet decided so they get notified when accepted
    if (typeof window !== 'undefined' && 'Notification' in window && getNotificationPermission() === 'default') {
      requestNotificationPermission().catch(() => {});
    }
    try {
      await sendFriendRequest(currentUser.id, targetUserId);
      setSearchResults(prev =>
        prev.map(u => u.id === targetUserId ? { ...u, friendshipStatus: 'pending', isRequester: true } : u)
      );
      await loadFriends();
    } catch (err) {
      console.error('Failed to send friend request:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const actionFriend = async (targetUserId: string, action: 'accept' | 'reject') => {
    setActionLoadingId(targetUserId);
    if (action === 'accept' && typeof window !== 'undefined' && 'Notification' in window && getNotificationPermission() === 'default') {
      requestNotificationPermission().catch(() => {});
    }
    try {
      await handleFriendAction(currentUser.id, targetUserId, action);
      await loadFriends();
      setSearchResults(prev =>
        prev.map(u => u.id === targetUserId ? { ...u, friendshipStatus: action === 'accept' ? 'accepted' : 'none' } : u)
      );
    } catch (err) {
      console.error('Failed to handle friend action:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const incomingRequests = friends.filter(f => f.status === 'pending' && f.requester_id !== currentUser.id);
  const outgoingRequests = friends.filter(f => f.status === 'pending' && f.requester_id === currentUser.id);
  const activeRivals = friends.filter(f => f.status === 'accepted');

  if (selectedRival) {
    return (
      <div className="w-full max-w-5xl mx-auto p-1 sm:p-2 animate-in fade-in duration-200">
        <RivalChat
          currentUser={currentUser}
          rival={{
            id: selectedRival.id,
            codm_ign: selectedRival.codm_ign || selectedRival.codmIgn,
            avatar: selectedRival.avatar,
            tier: selectedRival.tier,
          }}
          openChallengeOnMount={openChallengeInChat}
          onSyncAppState={onSyncAppState}
          onChallenge={(rivalId) => onOpenCreateBet(undefined, undefined, rivalId)}
          onBack={() => {
            setSelectedRival(null);
            setOpenChallengeInChat(false);
            loadFriends();
          }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* Tactical Banner Header */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <Crosshair size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black font-heading tracking-wider text-white uppercase">
                  CODM Rivals & Squad Net
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold tracking-widest uppercase">
                  ONLINE
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-mono mt-0.5">
                Search fellow gladiators by IGN, challenge rivals to 1v1 escrow wagers, and chat in tactical HUD
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {typeof window !== 'undefined' && 'Notification' in window && getNotificationPermission() === 'default' && (
              <button
                type="button"
                onClick={async () => {
                  await requestNotificationPermission();
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 text-amber-400 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                title="Enable Push Notifications for Rival Accepts"
              >
                <Bell size={13} className="animate-pulse" />
                <span>Enable Push Alerts</span>
              </button>
            )}
            <div className="px-3 py-1.5 rounded-xl bg-neutral-950/80 border border-neutral-800 text-xs font-mono text-neutral-300 flex items-center gap-2">
              <Users size={14} className="text-amber-400" />
              <span>Roster: <b className="text-white">{activeRivals.length}</b> Rivals</span>
            </div>
          </div>
        </div>

        {/* Tactical Search Console */}
        <form onSubmit={handleSearchSubmit} className="mt-5">
          <div className="relative flex items-center">
            <div className="absolute left-4 text-neutral-500 pointer-events-none flex items-center">
              <Search size={18} className="text-neutral-400" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              placeholder="Search rivals by CODM IGN, Gamer Tag, or Username..."
              className="w-full pl-12 pr-28 py-3.5 bg-neutral-950/90 border border-neutral-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl text-white placeholder-neutral-500 text-sm font-sans transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-24 text-neutral-500 hover:text-white p-1 cursor-pointer transition-colors"
                title="Clear input"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Crosshair size={14} className="stroke-[3]" />
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live Search Results Container */}
        {hasSearched && (
          <div className="mt-4 p-4 rounded-xl bg-neutral-950/90 border border-neutral-800/90 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Target size={14} className="text-amber-400" /> Search Results for "{searchTerm}" ({searchResults.length})
              </span>
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-[11px] font-mono text-neutral-400 hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="py-6 text-center text-neutral-400 text-xs font-mono">
                No players found matching "{searchTerm}". Check the exact CODM IGN and try again.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {searchResults.map((user) => {
                  const ign = user.codmIgn || user.codm_ign || user.username;
                  const isAccepted = user.friendshipStatus === 'accepted';
                  const isPending = user.friendshipStatus === 'pending';
                  const isRequester = user.isRequester;

                  return (
                    <div
                      key={user.id}
                      className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 hover:border-amber-400/40 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(ign)}`}
                          alt={ign}
                          className="w-9 h-9 rounded-lg bg-neutral-800 object-cover shrink-0 border border-neutral-700"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate font-heading">{ign}</div>
                          <div className="text-[10px] text-neutral-400 font-mono">
                            {user.wins || 0}W - {user.losses || 0}L
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {isAccepted ? (
                          <button
                            onClick={() => setSelectedRival({ id: user.id, codm_ign: ign })}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-neutral-950 border border-emerald-500/40 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                          >
                            <MessageCircle size={12} />
                            <span>Chat</span>
                          </button>
                        ) : isPending ? (
                          isRequester ? (
                            <span className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono uppercase font-bold flex items-center gap-1">
                              <Clock size={11} /> Sent
                            </span>
                          ) : (
                            <button
                              onClick={() => actionFriend(user.id, 'accept')}
                              disabled={actionLoadingId === user.id}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Check size={12} className="stroke-[3]" />
                              <span>Accept</span>
                            </button>
                          )
                        ) : (
                          <button
                            onClick={() => requestFriend(user.id)}
                            disabled={actionLoadingId === user.id}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 text-[11px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                          >
                            {actionLoadingId === user.id ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <UserPlus size={12} className="stroke-[2.5]" />
                            )}
                            <span>Recruit</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Incoming Requests Section (If Any) */}
      {incomingRequests.length > 0 && (
        <div className="bg-neutral-950 border border-amber-500/40 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h3 className="text-sm font-black font-heading text-white uppercase tracking-wider">
                Incoming Rival Requests ({incomingRequests.length})
              </h3>
            </div>
            <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/40 font-bold">
              Action Required
            </span>
          </div>

          <div className="space-y-2">
            {incomingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={req.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(req.codm_ign)}`}
                    alt={req.codm_ign}
                    className="w-10 h-10 rounded-lg object-cover bg-neutral-800 border border-neutral-700"
                  />
                  <div>
                    <div className="font-heading font-black text-sm text-white">{req.codm_ign}</div>
                    <div className="text-[10px] text-neutral-400 font-mono">Wants to add you to their 1v1 Rival Roster</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => actionFriend(req.id, 'accept')}
                    disabled={actionLoadingId === req.id}
                    className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase rounded-lg flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Accept</span>
                  </button>
                  <button
                    onClick={() => actionFriend(req.id, 'reject')}
                    disabled={actionLoadingId === req.id}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-rose-500/20 text-neutral-300 hover:text-rose-400 border border-neutral-700 hover:border-rose-500/40 font-bold text-xs uppercase rounded-lg flex items-center gap-1 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Outgoing Requests Section */}
      {outgoingRequests.length > 0 && (
        <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4">
          <h3 className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Clock size={13} className="text-amber-400" />
            <span>Pending Sent Requests ({outgoingRequests.length})</span>
          </h3>
          <div className="space-y-1.5">
            {outgoingRequests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-900/40 border border-neutral-800 text-xs"
              >
                <span className="font-mono text-neutral-300">{req.codm_ign}</span>
                <span className="text-[10px] text-amber-400 font-mono uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Awaiting Response
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Rivals Roster Section */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="text-base font-black font-heading text-white uppercase tracking-wider">
              Active Rivals ({activeRivals.length})
            </h3>
          </div>
          <span className="text-[11px] font-mono text-neutral-400">
            Encrypted 1v1 Chat & Direct Escrow Challenges
          </span>
        </div>

        {activeRivals.length === 0 ? (
          <div className="p-10 rounded-xl bg-neutral-900/40 border border-dashed border-neutral-800 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-neutral-800/80 border border-neutral-700 flex items-center justify-center text-amber-400 mx-auto">
              <Users className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-heading font-black text-sm text-white uppercase tracking-wider">
                No Rivals Recruited Yet
              </h4>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Use the tactical search bar above to look up other players by IGN, invite them as rivals, and initiate 1v1 wagers from direct chat!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeRivals.map((friend) => (
              <div
                key={friend.id}
                className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(friend.codm_ign)}`}
                      alt={friend.codm_ign}
                      className="w-11 h-11 rounded-xl object-cover bg-neutral-800 border border-neutral-700"
                    />
                    <div>
                      <div className="font-heading font-black text-sm text-white group-hover:text-amber-400 transition-colors">
                        {friend.codm_ign}
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Ready for duel</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800/80">
                  <button
                    onClick={() => {
                      setOpenChallengeInChat(false);
                      setSelectedRival(friend);
                    }}
                    className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Chat</span>
                  </button>

                  <button
                    onClick={() => {
                      setOpenChallengeInChat(true);
                      setSelectedRival(friend);
                    }}
                    className="py-2 px-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow font-heading"
                  >
                    <Trophy className="w-3.5 h-3.5" />
                    <span>1v1 Bet</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
