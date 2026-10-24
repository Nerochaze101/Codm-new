import React, { useState, useRef, useEffect } from 'react';
import { Match, UserProfile, ChatMessage } from '../types';
import {
  Swords, ShieldCheck, Trophy, Copy, Check, Upload, Send, AlertTriangle,
  CheckCircle2, Clock, Sparkles, MessageSquare, ArrowLeft, RefreshCw, FileText,
  Lock, Share2, UserCheck, Zap, Shield, XCircle
} from 'lucide-react';
import { StakePaymentModal } from './StakePaymentModal';
import { MatchLobbyChat } from './MatchLobbyChat';

interface MatchRoomProps {
  match: Match;
  currentUser: UserProfile;
  onBackToLobby: () => void;
  onSubmitResult: (claim: 'VICTORY' | 'DEFEAT' | 'DRAW', screenshotBase64?: string) => Promise<void>;
  onSendChat: (text: string) => Promise<void>;
  onRefreshMatch: () => Promise<void>;
  onOpponentStake?: (paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance' | 'flutterwave') => Promise<void>;
  onCreatorStake?: (paymentMethod: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance' | 'flutterwave') => Promise<void>;
  onSimulateOpponentStake?: () => Promise<void>;
  onSimulateOpponentResult?: (claim: 'VICTORY' | 'DEFEAT') => Promise<void>;
  onAdminResolve?: (winnerId: string) => Promise<void>;
  onCashOut?: (amount: number, bankDetails: { bankName: string; accountNumber: string; accountName: string }) => Promise<void>;
}

export const MatchRoom: React.FC<MatchRoomProps> = ({
  match,
  currentUser,
  onBackToLobby,
  onSubmitResult,
  onSendChat,
  onRefreshMatch,
  onOpponentStake,
  onCreatorStake,
  onSimulateOpponentStake,
  onSimulateOpponentResult,
  onAdminResolve,
  onCashOut,
}) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCreatorIgn, setCopiedCreatorIgn] = useState(false);
  const [copiedOpponentIgn, setCopiedOpponentIgn] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<'VICTORY' | 'DEFEAT' | 'DRAW'>('VICTORY');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [roomCashoutConfirming, setRoomCashoutConfirming] = useState(false);
  const [isRoomCashoutSubmitting, setIsRoomCashoutSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentRole, setPaymentRole] = useState<'opponent' | 'creator'>('opponent');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCreator = match.creator.id === currentUser.id;
  const isOpponent = match.opponent?.id === currentUser.id;
  const isParticipant = isCreator || isOpponent;

  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isExpired, setIsExpired] = useState<boolean>(false);

  useEffect(() => {
    if (!match.roomGeneratedAt || !match.matchDurationMinutes) return;
    const targetTime = match.roomGeneratedAt + (match.matchDurationMinutes * 60 * 1000);
    const updateTimer = () => {
      const diff = targetTime - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00');
        setIsExpired(true);
      } else {
        const mins = Math.floor(diff / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        setIsExpired(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [match]);

  const myClaim = isCreator ? match.creator.resultClaim : match.opponent?.resultClaim;
  const myScreenshot = isCreator ? match.creator.screenshotUrl : match.opponent?.screenshotUrl;
  const myAnalysis = isCreator ? match.creator.screenshotAnalysis : match.opponent?.screenshotAnalysis;

  const opponentObj = isCreator ? match.opponent : match.creator;
  const isWinner = match.status === 'SETTLED' && match.winnerId === currentUser.id;
  const isLoser = match.status === 'SETTLED' && match.winnerId && match.winnerId !== currentUser.id;

  const copyRoomCode = () => {
    if (match.roomCode) {
      navigator.clipboard.writeText(match.roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyChallengeLink = () => {
    const link = `${window.location.origin}/?join=${match.id}`;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const copyCreatorIgn = () => {
    navigator.clipboard.writeText(match.creator.codmIgn);
    setCopiedCreatorIgn(true);
    setTimeout(() => setCopiedCreatorIgn(false), 2000);
  };

  const copyOpponentIgn = () => {
    if (match.opponent?.codmIgn) {
      navigator.clipboard.writeText(match.opponent.codmIgn);
      setCopiedOpponentIgn(true);
      setTimeout(() => setCopiedOpponentIgn(false), 2000);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const useSampleVictoryScreenshot = () => {
    setScreenshotPreview('/src/assets/images/codm_score_victory_1791303464940.jpg');
    setSelectedClaim('VICTORY');
  };

  const useSampleDefeatScreenshot = () => {
    setScreenshotPreview('/src/assets/images/codm_sniper_shipment_1791303451126.jpg');
    setSelectedClaim('DEFEAT');
  };

  const handleResultSubmit = async (directClaim?: 'VICTORY' | 'DEFEAT' | 'DRAW') => {
    const claimToSubmit = directClaim || selectedClaim;
    const isConflict = match.status === 'DISPUTED';

    if (isConflict && !screenshotPreview) {
      setSubmitError('Conflict Detected: Please attach or select your scoreboard screenshot proof to resolve the dispute.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmitResult(claimToSubmit, screenshotPreview || undefined);
      if (isConflict) {
        setScreenshotPreview(null);
      }
    } catch (err: any) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput('');
    try {
      await onSendChat(text);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmStake = async (method: 'bank_transfer' | 'opay_palmpay' | 'card' | 'wallet_balance' | 'flutterwave') => {
    if (paymentRole === 'opponent' && onOpponentStake) {
      await onOpponentStake(method);
    } else if (paymentRole === 'creator' && onCreatorStake) {
      await onCreatorStake(method);
    }
    await onRefreshMatch();
  };

  const isAwaitingOpponent = match.status === 'PENDING_OPPONENT_STAKE';
  const isAwaitingCreatorStake = match.status === 'OPPONENT_STAKED_AWAITING_CREATOR';
  const isReadyToPlay = match.status === 'READY_TO_PLAY' || match.status === 'IN_PROGRESS';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top action bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBackToLobby}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefreshMatch()}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
            title="Refresh match status"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <span className="text-xs px-2.5 py-1 rounded font-mono-nums font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {match.status.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Settle Banner / Winner Announcement */}
      {(match.status === 'SETTLED' || match.status === 'ABANDONED_AND_SETTLED') && (
        <div className={`p-6 rounded-2xl border shadow-2xl relative overflow-hidden text-center space-y-4 ${
          isWinner || match.status === 'ABANDONED_AND_SETTLED'
            ? 'bg-gradient-to-b from-amber-500/20 via-neutral-900 to-neutral-950 border-amber-500/50'
            : 'bg-neutral-900 border-neutral-800'
        }`}>
          <div className="w-14 h-14 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-400 flex items-center justify-center mx-auto text-2xl">
            <Trophy className="w-7 h-7" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black font-heading tracking-wide text-white">
            {match.status === 'ABANDONED_AND_SETTLED' ? (
              <span className="text-rose-400">MATCH ABANDONED & SETTLED</span>
            ) : isWinner ? (
              <span className="text-amber-400">VICTORY! ₦{match.winnerPayout.toLocaleString()} WON</span>
            ) : (
              <span>MATCH CONCLUDED · WINNER: <span className="text-amber-400">{match.winnerIgn}</span></span>
            )}
          </h2>

          <p className="text-sm text-neutral-300 max-w-xl mx-auto">
            {match.resolutionNotes}
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs font-mono-nums">
            <span className="text-neutral-400">Total Pot: <strong>₦{match.potAmount.toLocaleString()}</strong></span>
            <span className="text-neutral-400">·</span>
            <span className="text-neutral-400">Platform Fee ({match.platformFeePercentage}%): <strong>₦{match.platformFee.toLocaleString()}</strong></span>
            <span className="text-neutral-400">·</span>
            <span className="text-emerald-400 font-bold">Winner Payout: ₦{match.winnerPayout.toLocaleString()}</span>
          </div>

          <div className="pt-4">
            <button
              onClick={onBackToLobby}
              className="px-6 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              Return to Lobby
            </button>
          </div>

          {/* Direct Cash Out Form if Winner has available balance */}
          {isWinner && currentUser.balance > 0 && (
            <div className="p-4 rounded-xl bg-neutral-900 border border-emerald-500/40 space-y-3 text-left max-w-md mx-auto mt-3">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-4 h-4 fill-current" />
                <span>Immediate Cash Out Winnings (Platform Holds ₦0)</span>
              </div>
              <p className="text-[11px] text-neutral-300">
                Send your winnings directly to your Nigerian bank account:
              </p>

              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Bank Name (e.g. OPay, GTBank, Kuda)"
                  defaultValue={currentUser.bankName || ''}
                  id="roomCashOutBankName"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Account Number (10 digits)"
                  defaultValue={currentUser.accountNumber || ''}
                  id="roomCashOutAccountNumber"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-xs font-mono-nums focus:border-amber-400 focus:outline-none"
                />
                <input
                  type="text"
                  placeholder="Account Name (e.g. John Doe)"
                  defaultValue={currentUser.accountName || currentUser.codmIgn}
                  id="roomCashOutAccountName"
                  className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-xs focus:border-amber-400 focus:outline-none"
                />
              </div>

              {roomCashoutConfirming ? (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-in fade-in">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Confirm Instant Bank Transfer</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Are you sure you want to cash out <strong>₦{currentUser.balance.toLocaleString()}</strong> to your bank account now? Payouts are sent immediately and cannot be cancelled.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isRoomCashoutSubmitting}
                      onClick={async () => {
                        const bankName = (document.getElementById('roomCashOutBankName') as HTMLInputElement)?.value;
                        const accountNumber = (document.getElementById('roomCashOutAccountNumber') as HTMLInputElement)?.value;
                        const accountName = (document.getElementById('roomCashOutAccountName') as HTMLInputElement)?.value;

                        if (!bankName || !accountNumber) {
                          alert('Please enter your Bank Name and Account Number.');
                          return;
                        }

                        if (onCashOut) {
                          setIsRoomCashoutSubmitting(true);
                          try {
                            await onCashOut(currentUser.balance, {
                              bankName,
                              accountNumber,
                              accountName: accountName || currentUser.codmIgn,
                            });
                            setRoomCashoutConfirming(false);
                            onRefreshMatch();
                          } finally {
                            setIsRoomCashoutSubmitting(false);
                          }
                        }
                      }}
                      className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs uppercase cursor-pointer transition-all shadow-md"
                    >
                      {isRoomCashoutSubmitting ? 'Sending...' : 'Yes, Confirm Payout Now'}
                    </button>
                    <button
                      type="button"
                      disabled={isRoomCashoutSubmitting}
                      onClick={() => setRoomCashoutConfirming(false)}
                      className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs cursor-pointer transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const bankName = (document.getElementById('roomCashOutBankName') as HTMLInputElement)?.value;
                    const accountNumber = (document.getElementById('roomCashOutAccountNumber') as HTMLInputElement)?.value;

                    if (!bankName || !accountNumber) {
                      alert('Please enter your Bank Name and Account Number before withdrawing.');
                      return;
                    }
                    setRoomCashoutConfirming(true);
                  }}
                  className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs transition-all shadow-lg cursor-pointer uppercase flex items-center justify-center gap-1.5"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Review & Cash Out ₦{currentUser.balance.toLocaleString()} to Bank</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 1 ESCROW BANNER: Awaiting Opponent to accept and send stake */}
      {isAwaitingOpponent && (
        <div className="p-5 rounded-2xl bg-neutral-900 border border-amber-500/40 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Step 1 of 2: Awaiting Opponent Stake
                </div>
                <div className="text-sm font-semibold text-white">
                  {isCreator
                    ? `Waiting for opponent to accept & deposit ₦${match.stakeAmount.toLocaleString()} stake`
                    : `You have been challenged to a ₦${match.stakeAmount.toLocaleString()} 1v1 duel!`}
                </div>
              </div>
            </div>

            <div className="text-right font-mono-nums">
              <span className="text-[10px] text-neutral-400 uppercase block">Stake Required</span>
              <span className="text-lg font-black text-amber-400">₦{match.stakeAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-neutral-300">
              {isCreator ? (
                <span>
                  Share this challenge link with your rival. Once they send their ₦{match.stakeAmount.toLocaleString()} stake into escrow, you will be prompted to send your matching stake and unlock the CODM room number.
                </span>
              ) : (
                <span>
                  Send your ₦{match.stakeAmount.toLocaleString()} stake to accept this match. The host will then send their matching stake to unlock your in-game room number.
                </span>
              )}
            </p>

            <div className="flex items-center gap-2 shrink-0">
              {isCreator ? (
                <>
                  <button
                    type="button"
                    onClick={copyChallengeLink}
                    className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
                  </button>

                  {onSimulateOpponentStake && (
                    <button
                      type="button"
                      onClick={() => onSimulateOpponentStake()}
                      className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Simulate Opponent Staking</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPaymentRole('opponent');
                    setShowPaymentModal(true);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black transition-all cursor-pointer shadow-xl flex items-center gap-2 uppercase tracking-wide animate-bounce"
                >
                  <Lock className="w-4 h-4 stroke-[2.5]" />
                  <span>Accept & Send ₦{match.stakeAmount.toLocaleString()} Stake</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 ESCROW BANNER: Opponent Staked -> Host must send matching stake */}
      {isAwaitingCreatorStake && (
        <div className="p-5 rounded-2xl bg-neutral-900 border-2 border-emerald-500/60 shadow-2xl space-y-4 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>Step 2 of 2: {match.opponent?.codmIgn} Has Deposited Stake!</span>
                </div>
                <div className="text-sm font-semibold text-white">
                  {isCreator
                    ? `Opponent deposited ₦${match.stakeAmount.toLocaleString()} into escrow! Send your matching stake to generate room number.`
                    : `Your ₦${match.stakeAmount.toLocaleString()} is secured in escrow. Waiting for host to send their matching stake.`}
                </div>
              </div>
            </div>

            <div className="text-right font-mono-nums">
              <span className="text-[10px] text-neutral-400 uppercase block">Host Matching Stake</span>
              <span className="text-lg font-black text-amber-400">₦{match.stakeAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-neutral-300">
              {isCreator ? (
                <span>
                  <strong>Action Required:</strong> Click below to send your matching ₦{match.stakeAmount.toLocaleString()} stake. Once confirmed, the system will immediately generate the official in-game CODM Private Room Number!
                </span>
              ) : (
                <span>
                  The host has been notified. As soon as the matching ₦{match.stakeAmount.toLocaleString()} stake is confirmed in escrow, your room number will appear here automatically.
                </span>
              )}
            </p>

            {isCreator && (
              <button
                type="button"
                onClick={() => {
                  setPaymentRole('creator');
                  setShowPaymentModal(true);
                }}
                className="px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black transition-all cursor-pointer shadow-2xl flex items-center gap-2 uppercase tracking-wide text-sm shrink-0"
              >
                <Lock className="w-4 h-4 stroke-[2.5]" />
                <span>Send Matching ₦{match.stakeAmount.toLocaleString()} Stake</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Live Countdown Timer Banner */}
      {match.roomGeneratedAt && ['READY_TO_PLAY', 'IN_PROGRESS', 'SUBMITTING_RESULTS', 'VERIFYING', 'DISPUTED'].includes(match.status) && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs shadow-md">
          <div className="flex items-center gap-2.5 text-neutral-300">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            <div>
              <div className="font-bold text-white text-sm">Match Countdown Timer</div>
              <div className="text-[11px] text-neutral-400">Finish match and submit result before time expires ({match.matchDurationMinutes || 15}m duration)</div>
            </div>
          </div>
          <span className={`font-mono font-black text-base px-4 py-2 rounded-xl ${isExpired ? 'bg-rose-500/20 text-rose-400 animate-bounce' : 'bg-amber-500/20 text-amber-400'}`}>
            {timeLeft || '15:00'}
          </span>
        </div>
      )}

      {/* STEP 3 BANNER: Both Stakes Confirmed -> Room Number Generated */}
      {isReadyToPlay && match.roomCode && (
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-neutral-900 to-emerald-500/10 border border-amber-500/60 shadow-2xl space-y-3 text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            <span>Both Stakes Confirmed in Escrow (Total Pot: ₦{match.potAmount.toLocaleString()})</span>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-mono text-neutral-400 uppercase tracking-widest">
              Official Private Room Number
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-3xl sm:text-5xl font-black font-mono-nums text-amber-400 tracking-wider drop-shadow-md">
                {match.roomCode}
              </span>
              <button
                type="button"
                onClick={copyRoomCode}
                className="p-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold transition-all cursor-pointer shadow-lg"
                title="Copy in-game room code"
              >
                {copiedCode ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-neutral-300 max-w-lg mx-auto">
            Open Mobile Shooter &gt; Multiplayer &gt; Private Match &gt; Join or create lobby with room code <strong className="text-amber-400 font-mono-nums">#{match.roomCode}</strong>.
          </p>
        </div>
      )}

      {/* Battle Header & Room Tracking Banner */}
      <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-4">
          <div>
            <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1">
              {match.roomCode ? 'In-Game Room Number' : 'Challenge Code'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl sm:text-3xl font-black font-mono-nums text-amber-400 tracking-wider">
                {match.roomCode || match.challengeCode}
              </span>
              <button
                onClick={match.roomCode ? copyRoomCode : copyChallengeLink}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Copy code"
              >
                {(match.roomCode ? copiedCode : copiedLink) ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-right">
              <div className="text-[10px] text-neutral-400 font-mono-nums uppercase">Escrow Pot</div>
              <div className="text-xl font-black text-amber-400 font-mono-nums">₦{match.potAmount.toLocaleString()}</div>
            </div>
            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-right">
              <div className="text-[10px] text-neutral-400 font-mono-nums uppercase">Winner Payout</div>
              <div className="text-xl font-black text-emerald-400 font-mono-nums">₦{match.winnerPayout.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Head-to-Head Contenders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Creator Profile */}
          <div className={`p-4 rounded-xl border transition-all ${
            match.winnerId === match.creator.id
              ? 'bg-amber-500/10 border-amber-400/80 shadow-md'
              : 'bg-neutral-950/70 border-neutral-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Host / Creator
              </span>
              <span className={`text-xs font-mono-nums font-bold px-2 py-0.5 rounded border ${
                match.creator.staked
                  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                  : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              }`}>
                {match.creator.staked ? `🔒 ₦${match.stakeAmount.toLocaleString()} Staked` : '⏳ Awaiting Stake'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <img
                src={match.creator.avatar}
                alt={match.creator.codmIgn}
                className="w-12 h-12 rounded-xl object-cover bg-neutral-800"
                referrerPolicy="no-referrer"
              />
              <div className="flex-1 min-w-0">
                <div className="text-base font-bold text-white truncate flex items-center gap-2">
                  <span>{match.creator.codmIgn}</span>
                  {match.winnerId === match.creator.id && (
                    <Trophy className="w-4 h-4 text-amber-400" />
                  )}
                </div>
                <div className="text-xs text-neutral-400 font-mono-nums truncate">
                  UID: {match.creator.codmUid}
                </div>
              </div>
              <button
                type="button"
                onClick={copyCreatorIgn}
                className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase cursor-pointer flex items-center gap-1 shrink-0 transition-all active:scale-95 shadow"
                title="One-tap copy Host CODM username"
              >
                {copiedCreatorIgn ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCreatorIgn ? 'Copied!' : 'Copy IGN'}</span>
              </button>
            </div>

            {match.creator.resultClaim && (
              <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Result Submitted:</span>
                <span className={`font-bold ${
                  match.creator.resultClaim === 'VICTORY' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {match.creator.resultClaim}
                </span>
              </div>
            )}
          </div>

          {/* Opponent Profile */}
          <div className={`p-4 rounded-xl border transition-all ${
            match.winnerId === match.opponent?.id
              ? 'bg-amber-500/10 border-amber-400/80 shadow-md'
              : 'bg-neutral-950/70 border-neutral-800'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Opponent / Rival
              </span>
              {match.opponent ? (
                <span className={`text-xs font-mono-nums font-bold px-2 py-0.5 rounded border ${
                  match.opponent.staked
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                }`}>
                  {match.opponent.staked ? `🔒 ₦${match.stakeAmount.toLocaleString()} Staked` : '⏳ Awaiting Stake'}
                </span>
              ) : (
                <span className="text-xs text-amber-400 font-medium">Awaiting Join...</span>
              )}
            </div>

            {match.opponent ? (
              <div className="flex items-center gap-3">
                <img
                  src={match.opponent.avatar}
                  alt={match.opponent.codmIgn}
                  className="w-12 h-12 rounded-xl object-cover bg-neutral-800"
                  referrerPolicy="no-referrer"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-base font-bold text-white truncate flex items-center gap-2">
                    <span>{match.opponent.codmIgn}</span>
                    {match.winnerId === match.opponent.id && (
                      <Trophy className="w-4 h-4 text-amber-400" />
                    )}
                  </div>
                  <div className="text-xs text-neutral-400 font-mono-nums truncate">
                    UID: {match.opponent.codmUid}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={copyOpponentIgn}
                  className="px-2.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-[10px] uppercase cursor-pointer flex items-center gap-1 shrink-0 transition-all active:scale-95 shadow"
                  title="One-tap copy Opponent CODM username"
                >
                  {copiedOpponentIgn ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedOpponentIgn ? 'Copied!' : 'Copy IGN'}</span>
                </button>
              </div>
            ) : (
              <div className="py-2 text-center text-xs text-neutral-400">
                Opponent has not accepted yet. Share the invite link with them!
              </div>
            )}

            {match.opponent?.resultClaim && (
              <div className="mt-3 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-xs">
                <span className="text-neutral-400">Result Submitted:</span>
                <span className={`font-bold ${
                  match.opponent.resultClaim === 'VICTORY' ? 'text-amber-400' : 'text-rose-400'
                }`}>
                  {match.opponent.resultClaim}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Game Setup & Proof Submission (Left) + Chat & Ref (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Match Rules & Result Submission */}
        <div className="lg:col-span-2 space-y-6">
          {/* In-Game Instructions */}
          <div className="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-3">
            <h3 className="text-sm font-bold font-heading uppercase text-white flex items-center gap-2">
              <Swords className="w-4 h-4 text-amber-400" />
              <span>Private Match Instructions</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-300">
              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-1">
                <div className="font-bold text-white">1. Create Custom Room In-Game</div>
                <p className="text-neutral-400">
                  Host opens Multiplayer &gt; Private Match. Map: <strong>{match.map}</strong>. Mode: <strong>{match.gameMode}</strong>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-1">
                <div className="font-bold text-white">2. Add Opponent via Tag</div>
                <p className="text-neutral-400">
                  Search opponent's IGN: <strong>{opponentObj ? opponentObj.codmIgn : 'Opponent'}</strong> and invite to your lobby.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-1">
                <div className="font-bold text-white">3. Follow Agreed Rules</div>
                <p className="text-neutral-400">
                  Sniper Only. No Operator Skills, No Scorestreaks. First to 10 kills or 5 rounds.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-neutral-950/80 border border-neutral-800/80 space-y-1">
                <div className="font-bold text-white">4. Screenshot Match End</div>
                <p className="text-neutral-400">
                  Capture final scoreboard showing Victory/Defeat badge with both player names visible.
                </p>
              </div>
            </div>
          </div>

          {/* Submission Card (Only active when match is in progress or awaiting results) */}
          {/* Submission Card (Fast 3-button confirmation; screenshot only on conflict) */}
          <div className="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold font-heading text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  <span>Match Result Confirmation</span>
                </h3>
                <p className="text-xs text-neutral-400">
                  Instant automated settlement: confirm winner with 3 buttons below. No screenshot required for agreed matches!
                </p>
              </div>

              {myClaim && (
                <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                  You Claimed: {myClaim === 'VICTORY' ? 'I Won 🏆' : myClaim === 'DEFEAT' ? 'I Lost ❌' : 'Draw ⚖️'}
                </span>
              )}
            </div>

            {submitError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {match.status === 'SETTLED' ? (
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <div className="text-sm font-bold text-white">Match Resolved & Paid Out</div>
                <p className="text-xs text-neutral-400">
                  This wager has concluded. Winning funds have been credited to the winner's wallet.
                </p>
              </div>
            ) : match.status === 'DISPUTED' || match.resubmissionNotice || (isCreator ? match.creator.resubmissionRequested : match.opponent?.resubmissionRequested) ? (
              /* CONFLICT DETECTED OR RESUBMISSION REQUESTED - SCREENSHOT REQUIRED */
              <div className="p-5 rounded-2xl bg-rose-950/40 border-2 border-rose-500/60 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="text-sm font-black text-rose-300 font-heading uppercase tracking-wide">
                      {match.resubmissionNotice ? '⚠️ Referee Notice: Screenshot Resubmission Required' : '⚠️ Conflict Detected: Both Players Submitted Conflicting Claims'}
                    </div>

                    {/* Transparent Conflict Explanation for Users */}
                    <div className="p-3.5 bg-black/70 rounded-xl border border-rose-500/30 text-xs text-neutral-200 leading-relaxed space-y-1.5">
                      <div className="text-[10px] text-amber-400 font-black uppercase tracking-wider font-mono">
                        Conflict Reason:
                      </div>
                      <p className="font-semibold text-white">
                        {match.conflictReason || match.resolutionNotes || 'Both players claimed conflicting outcomes. The escrow pot is securely frozen.'}
                      </p>
                      {(isCreator ? match.creator.resubmissionReason : match.opponent?.resubmissionReason) && (
                        <div className="text-[11px] text-amber-300 font-medium pt-1.5 border-t border-rose-500/20">
                          <strong className="text-amber-400">Rejection Notice:</strong> "{(isCreator ? match.creator.resubmissionReason : match.opponent?.resubmissionReason)}"
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-neutral-300">
                      The <strong>₦{match.potAmount.toLocaleString()}</strong> pot is held safely in escrow. Please upload your post-match CODM scoreboard screenshot proof to resolve the conflict and release your winnings.
                    </p>

                    {/* Anti-Cheat & Forensic System Standards */}
                    <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
                      <div className="font-bold text-neutral-300 uppercase tracking-widest text-[9px]">Proof Verification Standards:</div>
                      <div className="space-y-0.5 text-neutral-400">
                        <div>· Must be a full-screen <strong>landscape</strong> mobile screenshot (16:9 to 20:9 phone display).</div>
                        <div>· Room Code #{match.roomCode || match.challengeCode} and victory/defeat scoreboard must be clearly visible.</div>
                        <div>· System logic automatically verifies image headers and flags synthetic AI-generated 1:1 images.</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-rose-500/20">
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full sm:w-auto px-4 py-2 bg-rose-500 hover:bg-rose-400 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{screenshotPreview ? 'Change Scoreboard' : 'Upload Scoreboard Screenshot'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={useSampleVictoryScreenshot}
                      className="w-full sm:w-auto px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 text-xs font-bold rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Use Demo Scoreboard
                    </button>
                  </div>

                  {screenshotPreview && (
                    <div className="h-44 rounded-xl overflow-hidden border border-rose-500/50 relative bg-black">
                      <img
                        src={screenshotPreview}
                        alt="Scoreboard Preview"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute top-2 right-2 px-2.5 py-1 rounded bg-black/90 text-[10px] text-emerald-400 font-bold border border-emerald-500/40 font-mono">
                        PROOF READY FOR REFEREE REVIEW
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => handleResultSubmit(myClaim || 'VICTORY')}
                    disabled={isSubmitting || !screenshotPreview}
                    className="w-full py-3.5 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-xl text-xs sm:text-sm transition-all shadow-lg cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide"
                  >
                    {isSubmitting ? (
                      <>
                        <Sparkles className="w-4 h-4 animate-spin" />
                        <span>Referee Verifying Screenshot...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Submit Scoreboard Proof & Resolve Dispute</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : myClaim ? (
              /* Already submitted, waiting for opponent */
              <div className="p-5 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 text-sm font-bold">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Your Result Confirmed: {myClaim === 'VICTORY' ? 'I Won 🏆' : myClaim === 'DEFEAT' ? 'I Lost ❌' : 'Draw ⚖️'}</span>
                  </div>
                  <span className="text-xs text-amber-400 font-mono font-bold">₦{match.winnerPayout.toLocaleString()} Payout</span>
                </div>

                <div className="p-4 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
                  <div className="font-semibold text-white">
                    ⏳ Waiting for {opponentObj?.codmIgn || 'Opponent'} to confirm...
                  </div>
                  <p className="text-neutral-400 text-[11px]">
                    ⚡ Fast instant payout: as soon as both players agree, funds will be released immediately to the winner's wallet without any screenshot delay.
                  </p>
                </div>
              </div>
            ) : (
              /* 3-BUTTON SUBMISSION FORM (NO SCREENSHOT REQUIRED) */
              <div className="space-y-4">
                {opponentObj && (isCreator ? match.opponent?.resultClaim : match.creator.resultClaim) && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      <strong>{opponentObj.codmIgn}</strong> declared: <strong className="underline">
                        {(isCreator ? match.opponent?.resultClaim : match.creator.resultClaim) === 'VICTORY'
                          ? 'I Won 🏆'
                          : (isCreator ? match.opponent?.resultClaim : match.creator.resultClaim) === 'DEFEAT'
                          ? 'I Lost ❌'
                          : 'Draw ⚖️'}
                      </strong>. Confirm below to settle immediately!
                    </span>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block mb-2">
                    Select Your Match Outcome (3 Quick Buttons):
                  </label>
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedClaim('VICTORY')}
                      className={`py-3.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 uppercase ${
                        selectedClaim === 'VICTORY'
                          ? 'bg-emerald-500/25 border-emerald-400 text-emerald-400 shadow-md ring-2 ring-emerald-400/50'
                          : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-emerald-400" />
                      <span>I Won</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedClaim('DEFEAT')}
                      className={`py-3.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 uppercase ${
                        selectedClaim === 'DEFEAT'
                          ? 'bg-rose-500/25 border-rose-400 text-rose-400 shadow-md ring-2 ring-rose-400/50'
                          : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>I Lost</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedClaim('DRAW')}
                      className={`py-3.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-1.5 uppercase ${
                        selectedClaim === 'DRAW'
                          ? 'bg-amber-500/25 border-amber-400 text-amber-400 shadow-md ring-2 ring-amber-400/50'
                          : 'bg-neutral-950 text-neutral-300 border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <Shield className="w-4 h-4 text-amber-400" />
                      <span>Draw</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleResultSubmit()}
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs sm:text-sm transition-all cursor-pointer shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 uppercase tracking-wide"
                >
                  {isSubmitting ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin" />
                      <span>Confirming Result...</span>
                    </>
                  ) : selectedClaim === 'VICTORY' ? (
                    <>
                      <Trophy className="w-4 h-4" />
                      <span>Confirm "I Won" & Claim ₦{match.winnerPayout.toLocaleString()}</span>
                    </>
                  ) : selectedClaim === 'DEFEAT' ? (
                    <>
                      <XCircle className="w-4 h-4" />
                      <span>Confirm "I Lost" (Concede & Settle)</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Confirm "Draw" & Rematch</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>


          {/* Test Action Bar for 1-device demonstration */}
          {onSimulateOpponentResult && match.status !== 'SETTLED' && (
            <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-2">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Simulate Opponent Proof (For Fast Testing)</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                Trigger opponent submission without opening a second tab:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => onSimulateOpponentResult('DEFEAT')}
                  className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-emerald-400 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Opponent Submits Defeat (You Win ₦{match.winnerPayout.toLocaleString()})
                </button>
                <button
                  onClick={() => onSimulateOpponentResult('VICTORY')}
                  className="py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-rose-400 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Opponent Claims Victory (Trigger Dispute)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Match Chat & Referee Feed */}
        <div className="space-y-4">
          <MatchLobbyChat
            matchId={match.id}
            currentUser={currentUser}
            opponentName={isCreator ? (match.opponent?.codmIgn || 'Opponent') : match.creator.codmIgn}
            initialMessages={match.chatMessages || []}
            isSettled={['SETTLED', 'ABANDONED', 'CANCELLED'].includes(match.status)}
          />
        </div>
      </div>

      {/* Direct Escrow Stake Payment Modal */}
      <StakePaymentModal
        isOpen={showPaymentModal}
        match={match}
        currentUser={currentUser}
        role={paymentRole}
        onClose={() => setShowPaymentModal(false)}
        onConfirmStake={handleConfirmStake}
      />
    </div>
  );
};
