import React, { useState } from 'react';
import { UserProfile } from '../types';
import {
  X, Swords, ShieldCheck, AlertCircle, Crosshair, Target, Zap,
  Flame, Users, Flag, MapPin, Gamepad2, Clock, Globe, Lock
} from 'lucide-react';
import { CODM_IMAGES } from '../assets/images';
import { calculateMatchEconomics, calculateSquadEconomics } from '../utils/pricing';

interface CreateBetModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  initialMode?: string;
  initialStake?: number;
  onClose: () => void;
  onSubmit: (data: {
    stakeAmount: number;
    gameMode: string;
    map: string;
    rules: string[];
    matchDurationMinutes?: number;
    isPublic?: boolean;
    matchType?: 'solo' | 'squad';
  }) => Promise<void>;
  onOpenWallet?: () => void;
}


export const CreateBetModal: React.FC<CreateBetModalProps> = ({
  currentUser,
  isOpen,
  initialMode,
  initialStake,
  onClose,
  onSubmit,
  onOpenWallet,
}) => {
  const [betType, setBetType] = useState<'solo' | 'squad'>('solo');
  const [stakeInput, setStakeInput] = useState<string>('100');
  const [gameModeInput, setGameModeInput] = useState<string>('1v1 Sniper Only');
  const [mapInput, setMapInput] = useState<string>('Shipment');
  const [rulesInput, setRulesInput] = useState<string>('Standard 1v1 rules. No scorestreaks/operators. Screenshot proof required.');
  const [durationInput, setDurationInput] = useState<number>(15);
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync initial mode and stake when opened
  React.useEffect(() => {
    if (isOpen) {
      if (initialStake && initialStake >= 100) {
        setStakeInput(initialStake.toString());
      } else if (!stakeInput) {
        setStakeInput('100');
      }
      if (initialMode) {
        setGameModeInput(initialMode);
      }
      setDurationInput(15);
      setIsPublic(true);
    }
  }, [isOpen, initialMode, initialStake]);

  if (!isOpen) return null;

  const parsedStake = parseInt(stakeInput, 10);
  const stakeAmount = isNaN(parsedStake) ? 0 : parsedStake;
  const { potAmount, rakePercentFormatted, platformFee, winnerPayout } = calculateMatchEconomics(Math.max(0, stakeAmount));

  const handleCreate = async () => {
    if (!stakeInput.trim() || isNaN(parsedStake) || parsedStake < 100) {
      setError('Minimum stake amount is ₦100');
      return;
    }
    if (currentUser.balance < parsedStake) {
      setError(`Insufficient wallet balance (₦${currentUser.balance.toLocaleString()}). Please fund your wallet to host this wager.`);
      return;
    }
    if (!gameModeInput.trim()) {
      setError('Please enter a game mode');
      return;
    }
    if (!mapInput.trim()) {
      setError('Please enter a map name');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        stakeAmount: parsedStake,
        gameMode: gameModeInput.trim(),
        map: mapInput.trim(),
        rules: [
          rulesInput.trim() || 'Custom CODM match rules agreed by players',
          'No cheat modifications or glitches',
          'Post-match scoreboard screenshot required for AI verification',
        ],
        matchDurationMinutes: durationInput,
        isPublic,
        matchType: betType,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create wager');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-800 bg-neutral-950/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Swords className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-heading text-white">Create Custom Match Wager</h2>
              <p className="text-[11px] text-neutral-400 font-mono-nums">Balance: <strong className="text-emerald-400">₦{currentUser.balance.toLocaleString()}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Betting Format */}
          <div>
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-2.5">
              1. Choose Betting Format
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setBetType('solo');
                  setGameModeInput('1v1 Sniper Only');
                  setMapInput('Shipment');
                }}
                className={`relative overflow-hidden p-3.5 rounded-2xl border text-left transition-all cursor-pointer group flex flex-col justify-between h-24 ${
                  betType === 'solo'
                    ? 'bg-neutral-900 border-amber-400 text-white shadow-lg ring-1 ring-amber-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={CODM_IMAGES.shipment1v1}
                  alt="Shipment"
                  className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    betType === 'solo' ? 'bg-amber-400 text-neutral-950 font-black' : 'bg-neutral-900 text-neutral-400'
                  }`}>
                    <Crosshair className="w-3.5 h-3.5" />
                  </div>
                  {betType === 'solo' && (
                    <span className="w-4 h-4 rounded-full bg-amber-400 text-neutral-950 flex items-center justify-center font-bold text-[9px]">✓</span>
                  )}
                </div>
                <div className="relative z-10">
                  <div className="font-heading font-black text-xs text-white uppercase">Solo (1v1)</div>
                  <div className="text-[10px] text-neutral-400">Shipment 1v1 Duel</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setBetType('squad');
                  setGameModeInput('Search & Destroy (S&D)');
                  setMapInput('Standoff');
                }}
                className={`relative overflow-hidden p-3.5 rounded-2xl border text-left transition-all cursor-pointer group flex flex-col justify-between h-24 ${
                  betType === 'squad'
                    ? 'bg-neutral-900 border-emerald-400 text-white shadow-lg ring-1 ring-emerald-400'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 opacity-75 hover:opacity-100'
                }`}
              >
                <img
                  src={CODM_IMAGES.squadTactical}
                  alt="Squad"
                  className="absolute inset-0 w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-transparent" />
                <div className="relative z-10 flex items-center justify-between">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    betType === 'squad' ? 'bg-emerald-400 text-neutral-950 font-black' : 'bg-neutral-900 text-neutral-400'
                  }`}>
                    <Users className="w-3.5 h-3.5" />
                  </div>
                  {betType === 'squad' && (
                    <span className="w-4 h-4 rounded-full bg-emerald-400 text-neutral-950 flex items-center justify-center font-bold text-[9px]">✓</span>
                  )}
                </div>
                <div className="relative z-10">
                  <div className="font-heading font-black text-xs text-white uppercase">Squad (Team)</div>
                  <div className="text-[10px] text-neutral-400">Team Tactical Match</div>
                </div>
              </button>
            </div>
          </div>

          {/* Public / Private Visibility Toggle */}
          <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-200 uppercase flex items-center gap-1.5">
                {isPublic ? <Globe className="w-3.5 h-3.5 text-amber-400" /> : <Lock className="w-3.5 h-3.5 text-amber-400" />}
                <span>Match Visibility</span>
              </span>
              <div className="flex rounded-lg bg-neutral-900 p-1 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    isPublic ? 'bg-amber-400 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Public
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    !isPublic ? 'bg-amber-400 text-neutral-950 shadow' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Private
                </button>
              </div>
            </div>
            <p className="text-[11px] text-neutral-400">
              {isPublic
                ? 'Public bets appear in the Live Open Challenges lobby for anyone to accept.'
                : 'Private bets are hidden from public lobbies and can only be joined via your direct invite link.'}
            </p>
          </div>

          {/* Custom Game Mode Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Gamepad2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Game Mode Name</span>
            </label>
            <input
              type="text"
              value={gameModeInput}
              onChange={(e) => setGameModeInput(e.target.value)}
              placeholder="e.g. 1v1 Sniper Only, Custom S&D"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:outline-none focus:border-amber-400 font-medium"
            />
          </div>

          {/* Custom Map Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Map Name</span>
            </label>
            <input
              type="text"
              value={mapInput}
              onChange={(e) => setMapInput(e.target.value)}
              placeholder="e.g. Shipment, Standoff, Nuketown"
              className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white text-sm focus:outline-none focus:border-emerald-400 font-medium"
            />
          </div>

          {/* Match Expiration Duration Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Match Expiration Duration</span>
            </label>
            <div className="grid grid-cols-5 gap-2">
              {[10, 15, 30, 45, 60].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDurationInput(mins)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    durationInput === mins
                      ? 'bg-amber-400 text-neutral-950 border-amber-400 shadow-md scale-105'
                      : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {mins}m
                </button>
              ))}
            </div>
            <p className="text-[10px] text-neutral-400">Match auto-expires if results are not submitted within this duration.</p>
          </div>

          {/* Stake Amount Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                Stake Amount (₦ Naira)
              </label>
              <span className="text-xs text-amber-400 font-bold">
                Deducted Immediately from Wallet
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-2">
              {[100, 500, 1000, 2500, 5000, 10000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => {
                    setStakeInput(amt.toString());
                    setError(null);
                  }}
                  className={`py-2 rounded-xl text-xs font-black font-mono-nums transition-all cursor-pointer border ${
                    parsedStake === amt
                      ? 'bg-amber-400 text-neutral-950 border-amber-400 shadow-md scale-105'
                      : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  ₦{amt.toLocaleString()}
                </button>
              ))}
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs text-amber-400 font-black font-mono-nums">₦</span>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={stakeInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setStakeInput(val);
                  setError(null);
                }}
                placeholder="Enter custom stake"
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-700 text-white font-mono-nums font-bold text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="text-[11px] text-neutral-400 mt-1.5">Minimum stake is ₦100 · Tiered Platform Rake (10% down to 5%)</div>
          </div>

          {/* Escrow Math Preview */}
          {betType === 'squad' ? (() => {
            const squadEcon = calculateSquadEconomics(Math.max(0, stakeAmount), 5);
            return (
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-emerald-500/30 text-xs space-y-1.5 font-mono-nums">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-neutral-800 pb-1.5 mb-1.5">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> 5v5 Squad Wager (10 Players Total)</span>
                  <span className="text-[10px] text-neutral-400 font-normal">Auto 5vs5 Split</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Individual Stake:</span>
                  <span className="text-white font-bold">₦{squadEcon.stakePerPlayer.toLocaleString()} / player</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Total Gross Pot (10 x Stake):</span>
                  <span className="text-amber-400 font-bold text-sm">₦{squadEcon.totalPot.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>OpsSTAKE Rake ({squadEcon.rakePercentFormatted}):</span>
                  <span className="text-rose-400">-₦{squadEcon.platformFee.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400 font-bold pt-1.5 border-t border-neutral-800">
                  <span>Net Squad Prize Pool:</span>
                  <span className="text-sm">₦{squadEcon.netWinningPool.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-300 font-bold bg-emerald-950/40 p-2 rounded-lg border border-emerald-500/20 mt-1">
                  <span>Payout per Winning Player (5 Winners):</span>
                  <span className="text-sm text-emerald-400">₦{squadEcon.payoutPerPlayer.toLocaleString()}</span>
                </div>
              </div>
            );
          })() : (() => {
            const soloEcon = calculateMatchEconomics(Math.max(0, stakeAmount));
            return (
              <div className="p-3.5 rounded-xl bg-neutral-950 border border-neutral-800 text-xs space-y-1.5 font-mono-nums">
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Total Escrow Pot (2x Stake):</span>
                  <span className="text-amber-400 font-bold text-sm">₦{soloEcon.potAmount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span>Tiered Platform Rake ({soloEcon.rakePercentFormatted}):</span>
                  <span className="text-rose-400">-₦{soloEcon.platformFee.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-emerald-400 font-bold pt-1 border-t border-neutral-800">
                  <span>Winner Payout:</span>
                  <span className="text-sm">₦{soloEcon.winnerPayout.toLocaleString()}</span>
                </div>
              </div>
            );
          })()}


          {/* Hosting & Refund Policy Note */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-neutral-300 flex items-start gap-2.5 leading-relaxed">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="text-amber-300">Hosting & Cancellation Rules:</strong>
              <div className="text-[11px] text-neutral-400 mt-0.5">
                1. Your ₦{stakeAmount.toLocaleString()} stake is deducted from your wallet immediately upon hosting.<br />
                2. You can cancel anytime before an opponent accepts to get a <strong>100% full refund</strong>.<br />
                3. Once accepted by an opponent, the match is locked and cannot be cancelled.
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleCreate}
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <span>Hosting Match...</span>
            ) : (
              <>
                <Swords className="w-4 h-4 stroke-[2.5]" />
                <span>Host & Deduct ₦{stakeAmount.toLocaleString()}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
