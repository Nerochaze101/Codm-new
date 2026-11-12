import React, { useState, useEffect } from 'react';
import { UserProfile, Match } from '../types';
import {
  ShieldAlert, CheckCircle2, AlertTriangle, Send, ExternalLink, MessageSquare, Copy, Check
} from 'lucide-react';
import { VideoTutorial } from './VideoTutorial';

interface DisputesPageProps {
  currentUser: UserProfile;
  matches: Match[];
  onRefresh: () => Promise<void>;
}

export const DisputesPage: React.FC<DisputesPageProps> = ({ currentUser, matches, onRefresh }) => {
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState<string>('OpsSTAKEBOT');

  useEffect(() => {
    fetch('/api/telegram/bot-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.botUsername) setTelegramBotUsername(data.botUsername);
      })
      .catch(() => {});
  }, []);

  const disputedMatches = matches.filter(m => {
    const isCreator = m.creator.id === currentUser.id;
    const isOpponent = m.opponent?.id === currentUser.id;
    return (isCreator || isOpponent) && (m.status === 'DISPUTED' || m.resubmissionNotice || m.creator.resubmissionRequested || m.opponent?.resubmissionRequested);
  });

  const activeMatch = disputedMatches.find(m => m.id === selectedMatchId) || disputedMatches[0];

  const handleCopyCommand = (cmdText: string, matchId: string) => {
    navigator.clipboard.writeText(cmdText);
    setCopiedCode(matchId);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-[2.55rem] bg-gradient-to-r from-neutral-900 via-neutral-950 to-neutral-900 border-2 border-rose-500/40 p-8 sm:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-black uppercase tracking-[0.2em]">
              <ShieldAlert size={14} className="animate-pulse" />
              <span>Telegram Bot /dispute Automation & Referee Review</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black font-heading text-white uppercase tracking-tighter">
              DISPUTE <span className="text-rose-400">RESOLUTION</span>
            </h1>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-xl leading-relaxed">
              When a match enters a disputed state, pots are safely locked in escrow. Use the automated Telegram bot command button below to send your screen recording directly to referees.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-center min-w-[200px] shadow-xl">
            <span className="text-[10px] uppercase font-mono text-neutral-400 block">Disputed Matches</span>
            <div className="text-3xl font-black text-rose-400 font-mono mt-1">
              {disputedMatches.length}
            </div>
            <span className="text-[10px] text-neutral-500 font-mono">Escrow Protected</span>
          </div>
        </div>
      </div>

      {/* Video Tutorial Guide */}
      <VideoTutorial
        title="Mandatory Video Guide: How to Make Screen Recording Proofs"
        description="Follow this tutorial to record your match history and end-game scoreboard. Video evidence is sent securely via the Telegram bot."
      />

      {/* Active Dispute Match Selector & Telegram Bot Action */}
      <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-6 shadow-xl">
        <div className="flex items-center gap-3 pb-4 border-b border-neutral-800">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black font-heading text-white uppercase">
              Submit Screen Recording via Telegram Bot
            </h2>
            <p className="text-xs text-neutral-400">Select your disputed match below and launch the Telegram bot command</p>
          </div>
        </div>

        {disputedMatches.length === 0 ? (
          <div className="py-12 text-center space-y-3 bg-neutral-950 rounded-2xl border border-neutral-800">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <div className="text-sm font-bold text-white uppercase tracking-wide">No Active Disputes</div>
            <p className="text-xs text-neutral-400 max-w-md mx-auto">
              You have no matches currently in dispute. All your wagers are either active, settled smoothly, or pending confirmation.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Match selector cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {disputedMatches.map(m => {
                const isSelected = activeMatch?.id === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedMatchId(m.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-rose-500/10 border-rose-500 shadow-xl'
                        : 'bg-neutral-950 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded border border-rose-500/30">
                        #{m.challengeCode}
                      </span>
                      <span className="text-xs font-black text-amber-400 font-mono">
                        Pot: ₦{m.potAmount.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-white">
                      {m.gameMode} · {m.map}
                    </div>
                    <div className="text-[10px] text-neutral-400 mt-1">
                      Status: <strong className="text-rose-400 uppercase">{m.status}</strong>
                    </div>
                  </button>
                );
              })}
            </div>

            {activeMatch && (
              <div className="p-6 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-6 animate-in fade-in">
                <div className="space-y-2">
                  <div className="text-xs font-black uppercase text-amber-400 font-mono">
                    Selected Match Details:
                  </div>
                  <div className="p-3.5 bg-neutral-900 rounded-xl border border-neutral-800 text-xs text-neutral-300 space-y-1">
                    <div><strong>Challenge Code:</strong> #{activeMatch.challengeCode}</div>
                    <div><strong>Room / Match ID:</strong> <code className="text-amber-400">{activeMatch.id}</code></div>
                    <div><strong>Game Mode:</strong> {activeMatch.gameMode} ({activeMatch.map})</div>
                    <div><strong>Pot Amount:</strong> ₦{activeMatch.potAmount.toLocaleString()}</div>
                    <div><strong>Conflict Reason:</strong> {activeMatch.conflictReason || activeMatch.resolutionNotes || 'Both players submitted conflicting claims.'}</div>
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-gradient-to-br from-sky-950/80 via-neutral-900 to-sky-950/60 border-2 border-sky-500/50 space-y-5 shadow-2xl animate-in fade-in">
                  <div className="flex items-center gap-3 border-b border-sky-500/20 pb-4">
                    <div className="w-12 h-12 rounded-2xl bg-sky-500/20 border border-sky-500/40 text-sky-400 flex items-center justify-center shrink-0 shadow-lg">
                      <Send className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white uppercase font-heading tracking-wide">
                        Automated Telegram Bot Evidence Gateway
                      </h4>
                      <p className="text-xs text-neutral-300">
                        Room Code: <code className="text-sky-300 font-mono font-bold bg-sky-500/20 px-2 py-0.5 rounded border border-sky-500/30">{activeMatch.roomCode || activeMatch.challengeCode}</code>
                      </p>
                    </div>
                  </div>

                  {/* Step-by-Step Instructions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                      <div className="font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-300 flex items-center justify-center text-[10px] font-mono">1</span>
                        <span>Room Code Auto-Linked</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-normal">
                        When a conflict occurs, <b>@{telegramBotUsername}</b> automatically locks Room Code <code className="text-sky-300 font-mono">#{activeMatch.roomCode || activeMatch.challengeCode}</code> and pings your Telegram DM for proof.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                      <div className="font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px] font-mono">2</span>
                        <span>Upload Screen Recording</span>
                      </div>
                      <p className="text-[11px] text-neutral-400 leading-normal">
                        Reply directly in the bot chat with your screen recording video. The bot forwards it straight to referees for manual review.
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Conflict Penalty Policy:</strong> Causing a false conflict incurs <strong>Strike 1 Account Flag + 10% Conflict Penalty Fee</strong> upon manual adjudication. <strong>Strike 2</strong> triggers an immediate <strong>Permanent Ban & 100% Fund Forfeiture</strong>.
                    </span>
                  </div>

                  {/* Primary Pre-filled Deep Link Action Button */}
                  <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                    <a
                      href={`https://t.me/${telegramBotUsername}?start=dispute_${encodeURIComponent(activeMatch.roomCode || activeMatch.challengeCode)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:flex-1 py-4 px-6 bg-gradient-to-r from-sky-500 to-sky-400 hover:from-sky-400 hover:to-sky-300 text-neutral-950 text-xs sm:text-sm font-black rounded-2xl transition-all shadow-xl shadow-sky-500/20 cursor-pointer flex items-center justify-center gap-2.5 uppercase tracking-wider active:scale-[0.98]"
                    >
                      <MessageSquare className="w-5 h-5 fill-neutral-950" />
                      <span>Launch Telegram Bot (/dispute {activeMatch.roomCode || activeMatch.challengeCode})</span>
                      <ExternalLink className="w-4 h-4 ml-1 opacity-80" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleCopyCommand(`/dispute ${activeMatch.roomCode || activeMatch.challengeCode}`, activeMatch.id)}
                      className="w-full sm:w-auto px-5 py-4 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-2xl border border-neutral-700 transition-all cursor-pointer flex items-center justify-center gap-2 font-mono shrink-0"
                    >
                      {copiedCode === activeMatch.id ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                          <span className="text-emerald-400">Command Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-neutral-400" />
                          <span>Copy Command</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[11px] text-sky-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>
                      Escrow protected. Once your video is received in Telegram, referees evaluate it and settle winnings.
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Official Telegram Review Group Card (Gated to Admin/Moderator Staff Only) */}
      {(currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'moderator') && (
        <div className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-4 shadow-xl text-center">
          <h3 className="text-base font-bold text-white uppercase font-heading">
            Official Referee Telegram Evidence Group
          </h3>
          <p className="text-xs text-neutral-400 max-w-lg mx-auto">
            Join our Telegram group to interact with human referees, view dispute status updates, and ensure lightning-fast escrow resolution.
          </p>
          <a
            href="https://t.me/+I5vcFF4RXwJkMWVk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-black text-xs uppercase tracking-wide transition-all shadow-lg"
          >
            <ExternalLink size={16} />
            <span>Join Telegram Dispute Group</span>
          </a>
        </div>
      )}
    </div>
  );
};
