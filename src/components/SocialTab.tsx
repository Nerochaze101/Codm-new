import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { searchFriends, sendFriendRequest, handleFriendAction, fetchFriends } from '../services/api';
import { Search, UserPlus, Check, X, MessageCircle, Trophy, Users, Shield, Clock, Crosshair, ArrowRight, Loader2 } from 'lucide-react';
import { RivalChat } from './RivalChat';

interface SocialTabProps {
  currentUser: UserProfile;
  onOpenCreateBet: (mode?: string, stake?: number, rivalId?: string) => void;
}

export const SocialTab: React.FC<SocialTabProps> = ({ currentUser, onOpenCreateBet }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [friends, setFriends] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [selectedRival, setSelectedRival] = useState<any>(null);

  useEffect(() => {
    loadFriends();
  }, [currentUser.id]);

  const loadFriends = async () => {
    try {
      const data = await fetchFriends(currentUser.id);
      setFriends(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to load rivals list:", e);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchTerm.trim();
    if (!query) return;

    setLoading(true);
    setHasSearched(true);
    try {
      const results = await searchFriends(query, currentUser.id);
      setSearchResults(Array.isArray(results) ? results : []);
    } catch (err) {
      console.error("Search failed:", err);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const requestFriend = async (targetUserId: string) => {
    setActionLoadingId(targetUserId);
    try {
      await sendFriendRequest(currentUser.id, targetUserId);
      // Update local search results state immediately
      setSearchResults(prev =>
        prev.map(u => u.id === targetUserId ? { ...u, friendshipStatus: 'pending', isRequester: true } : u)
      );
      await loadFriends();
    } catch (err) {
      console.error("Failed to send friend request:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const actionFriend = async (targetUserId: string, action: 'accept' | 'reject') => {
    setActionLoadingId(targetUserId);
    try {
      await handleFriendAction(currentUser.id, targetUserId, action);
      await loadFriends();
      // If accepted, update search results state too
      setSearchResults(prev =>
        prev.map(u => u.id === targetUserId ? { ...u, friendshipStatus: action === 'accept' ? 'accepted' : 'none' } : u)
      );
    } catch (err) {
      console.error("Failed to handle friend action:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const incomingRequests = friends.filter(f => f.status === 'pending' && f.requester_id !== currentUser.id);
  const outgoingRequests = friends.filter(f => f.status === 'pending' && f.requester_id === currentUser.id);
  const activeRivals = friends.filter(f => f.status === 'accepted');

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 font-sans">
      {/* Tactical Top Search Header */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Crosshair className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-heading">
                Rival Intelligence & Recruitment
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono">
                Locate gladiators by IGN or username to challenge for real stakes
              </p>
            </div>
          </div>
        </div>

        {/* Search Input Form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-neutral-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by CODM IGN or username (e.g. Ghost, Shadow)..."
              className="w-full bg-neutral-900 border border-neutral-700/80 rounded-xl pl-10 pr-10 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-amber-400 font-mono"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-3 text-neutral-500 hover:text-white p-0.5"
                title="Clear input"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !searchTerm.trim()}
            className="px-5 sm:px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 font-black text-xs sm:text-sm uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Searching...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 stroke-[2.5]" />
                <span>Search</span>
              </>
            )}
          </button>
        </form>

        {/* Search Results Display */}
        {hasSearched && (
          <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-mono text-neutral-400 px-1">
              <span>Search Results ({searchResults.length})</span>
              <button
                onClick={handleClearSearch}
                className="text-amber-400 hover:underline text-[11px]"
              >
                Clear
              </button>
            </div>

            {searchResults.length === 0 ? (
              <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 text-center text-xs text-neutral-400">
                No gladiators found matching <strong className="text-white">"{searchTerm}"</strong>. Double check spelling or search by partial name.
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((user) => {
                  const isActionLoading = actionLoadingId === user.id;
                  const isFriend = user.friendshipStatus === 'accepted';
                  const isPending = user.friendshipStatus === 'pending';

                  return (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.codmIgn)}`}
                          alt={user.codmIgn}
                          className="w-10 h-10 rounded-lg object-cover bg-neutral-800 border border-neutral-700"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-black text-sm text-white tracking-wide">
                              {user.codmIgn}
                            </span>
                            {user.tier && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                {user.tier}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono">
                            {user.clan || '[1V1_PRO]'} · {user.wins || 0}W - {user.losses || 0}L
                          </div>
                        </div>
                      </div>

                      <div>
                        {isFriend ? (
                          <button
                            onClick={() => setSelectedRival({ id: user.id, codm_ign: user.codmIgn })}
                            className="px-3.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-400 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-1.5"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        ) : isPending ? (
                          user.isRequester ? (
                            <span className="px-3 py-1.5 bg-neutral-800 text-neutral-400 border border-neutral-700 rounded-lg text-xs font-mono font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>Request Sent</span>
                            </span>
                          ) : (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => actionFriend(user.id, 'accept')}
                                disabled={isActionLoading}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase rounded-lg"
                              >
                                Accept
                              </button>
                              <button
                                onClick={() => actionFriend(user.id, 'reject')}
                                disabled={isActionLoading}
                                className="px-2 py-1.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-bold rounded-lg"
                              >
                                Reject
                              </button>
                            </div>
                          )
                        ) : (
                          <button
                            onClick={() => requestFriend(user.id)}
                            disabled={isActionLoading}
                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow active:scale-95 flex items-center gap-1.5 cursor-pointer"
                          >
                            {isActionLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                            )}
                            <span>Add Friend</span>
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

      {/* Main Content Area: Chat or Rivals List */}
      {selectedRival ? (
        <div className="bg-neutral-950 border border-neutral-800 p-5 sm:p-6 rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-800">
            <button
              onClick={() => setSelectedRival(null)}
              className="text-amber-400 hover:text-amber-300 font-heading font-black uppercase text-xs tracking-wider flex items-center gap-1 cursor-pointer"
            >
              <span>← Back to Rivals List</span>
            </button>
            <span className="text-xs font-mono text-neutral-400">
              Encrypted 1v1 Room
            </span>
          </div>

          <RivalChat
            currentUser={currentUser}
            rival={{ id: selectedRival.id, codm_ign: selectedRival.codm_ign }}
            onChallenge={(rivalId) => onOpenCreateBet(undefined, undefined, rivalId)}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Incoming Requests Section (If Any) */}
          {incomingRequests.length > 0 && (
            <div className="bg-neutral-950 border border-amber-500/30 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-black font-heading text-white uppercase tracking-wider">
                    Incoming Challenge Requests ({incomingRequests.length})
                  </h3>
                </div>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/40 font-bold">
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
                        className="w-9 h-9 rounded-lg object-cover bg-neutral-800"
                      />
                      <div>
                        <div className="font-heading font-black text-sm text-white">{req.codm_ign}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">Wants to add you as a rival</div>
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
              <h3 className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider mb-2.5">
                Pending Sent Requests ({outgoingRequests.length})
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

          {/* Active Rivals Section */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <h3 className="text-base font-black font-heading text-white uppercase tracking-wider">
                  Active Rivals ({activeRivals.length})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                Direct Chat & 1v1 Escrow Duels
              </span>
            </div>

            {activeRivals.length === 0 ? (
              <div className="p-8 rounded-xl bg-neutral-900/40 border border-dashed border-neutral-800 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-500 mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-heading font-black text-sm text-white uppercase">No Rivals on Roster</h4>
                  <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                    Search above for fellow CODM players by IGN, recruit them as rivals, and initiate direct 1v1 wagers from private chat!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeRivals.map((friend) => (
                  <div
                    key={friend.id}
                    className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-amber-500/40 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <img
                          src={friend.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(friend.codm_ign)}`}
                          alt={friend.codm_ign}
                          className="w-10 h-10 rounded-lg object-cover bg-neutral-800 border border-neutral-700"
                        />
                        <div>
                          <div className="font-heading font-black text-sm text-white group-hover:text-amber-400 transition-colors">
                            {friend.codm_ign}
                          </div>
                          <div className="text-[11px] text-neutral-400 font-mono">
                            {friend.tier || 'LEGENDARY TIER'}
                          </div>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Ready to duel" />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-neutral-800/80">
                      <button
                        onClick={() => setSelectedRival(friend)}
                        className="py-2 px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Chat</span>
                      </button>

                      <button
                        onClick={() => onOpenCreateBet(undefined, undefined, friend.id)}
                        className="py-2 px-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow"
                      >
                        <Trophy className="w-3.5 h-3.5" />
                        <span>Challenge</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

