import React, { useState } from 'react';
import {
  BookOpen, ShieldCheck, Swords, Scale, Users, Wallet, Globe, Bot,
  CheckCircle2, Copy, Check, ExternalLink, FileText, ArrowRight, Sparkles, Lock, Zap
} from 'lucide-react';
import { TIERED_COMMISSION_SCHEDULE, calculateSquadEconomics } from '../utils/pricing';
import { Logo } from './Logo';

interface DocsPageProps {
  onNavigateToArena: () => void;
  onNavigateToRules: () => void;
  onNavigateToLanding: () => void;
}

export const DocsPage: React.FC<DocsPageProps> = ({
  onNavigateToArena,
  onNavigateToRules,
  onNavigateToLanding,
}) => {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://opsstake.online';

  const squadSample = calculateSquadEconomics(1000, 5, 5);

  const crawlerResources = [
    { label: 'XML Sitemap (Submit to Google Search Console)', path: '/sitemap.xml' },
    { label: 'Robots Policy (robots.txt)', path: '/robots.txt' },
    { label: 'AI Crawler Summary (llms.txt)', path: '/llms.txt' },
    { label: 'Full AI Documentary (llms-full.txt)', path: '/llms-full.txt' },
    { label: 'Canonical Docs Page', path: '/docs' },
  ];

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <article className="max-w-5xl mx-auto space-y-10 pb-16 font-sans">
      {/* Hero Header */}
      <header className="relative overflow-hidden rounded-3xl bg-neutral-900 border border-amber-500/30 p-7 sm:p-10 shadow-2xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Logo size={52} glow={true} />
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-1">
                <BookOpen size={11} />
                <span>Official Platform Documentary</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black font-heading text-white uppercase tracking-tight">
                OpsSTAKE Architecture & Rules Guide
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onNavigateToArena}
              className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all"
            >
              <Swords size={14} />
              <span>Enter Arena</span>
            </button>
            <button
              type="button"
              onClick={onNavigateToLanding}
              className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase tracking-wider cursor-pointer transition-all"
            >
              Overview
            </button>
          </div>
        </div>

        <p className="text-sm text-neutral-300 leading-relaxed max-w-3xl">
          <strong>OpsSTAKE</strong> is an independent competitive mobile shooter esports wagering and automated escrow platform operating in <strong>Nigerian Naira (₦)</strong>. Players challenge opponents in 1v1 duels or 5v5 squad matches with both sides&apos; stakes secured in escrow, verified via AI scoreboard inspection and human referees, and paid out directly to Nigerian bank accounts.
        </p>

        <nav aria-label="Document Sections" className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800/80 text-xs">
          <a href="#escrow-flow" className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-amber-400/50 text-neutral-300 hover:text-amber-400 transition-colors">
            1. Escrow Lifecycle
          </a>
          <a href="#formats" className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-amber-400/50 text-neutral-300 hover:text-amber-400 transition-colors">
            2. Modes & Maps
          </a>
          <a href="#fees" className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-amber-400/50 text-neutral-300 hover:text-amber-400 transition-colors">
            3. Commission Schedule
          </a>
          <a href="#integrity" className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-amber-400/50 text-neutral-300 hover:text-amber-400 transition-colors">
            4. Verification & Fair Play
          </a>
          <a href="#social-comms" className="px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 hover:border-amber-400/50 text-neutral-300 hover:text-amber-400 transition-colors">
            5. Presence, Chat & Streaks
          </a>
          <a href="#indexing-hub" className="px-3 py-1.5 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300 hover:bg-amber-400/20 transition-colors font-semibold">
            6. Google & AI Indexing Hub
          </a>
        </nav>
      </header>

      {/* 1. Escrow Lifecycle */}
      <section id="escrow-flow" className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black font-heading text-white uppercase">1. Two-Step On-Demand Escrow Protocol</h2>
            <p className="text-xs text-neutral-400">How stakes are locked, matched, verified, and settled without counterparty risk</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              step: '01',
              title: 'Create Challenge (₦0 Upfront)',
              desc: 'Host picks game mode, map, stake, duration (15/20/30m), and rules. No funds are deducted until an opponent accepts.',
            },
            {
              step: '02',
              title: 'Opponent Accepts & Stakes',
              desc: 'Challenger opens the room via World Chat, 1v1 Rival Chat, or invite link and locks their Naira stake into escrow.',
            },
            {
              step: '03',
              title: 'Host Matches & Room Unlocks',
              desc: 'Host locks matching stake. Both stakes form the protected pot, generating the private room number and countdown timer.',
            },
            {
              step: '04',
              title: 'AI Verify & Bank Payout',
              desc: 'Players upload end-game scoreboard screenshots. Confirmed winners receive instant wallet credit for Nigerian bank withdrawal.',
            },
          ].map((item) => (
            <div key={item.step} className="p-4 rounded-2xl bg-neutral-950/90 border border-neutral-800 space-y-2">
              <span className="inline-block px-2 py-0.5 rounded bg-amber-400/15 text-amber-400 font-mono text-xs font-black">
                STEP {item.step}
              </span>
              <h3 className="text-sm font-bold text-white font-heading">{item.title}</h3>
              <p className="text-xs text-neutral-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 2. Modes & Maps */}
      <section id="formats" className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Swords size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black font-heading text-white uppercase">2. Supported Competitive Formats & Maps</h2>
            <p className="text-xs text-neutral-400">Head-to-head solo duels and full 10-player clan squad wagers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <h3 className="text-sm font-black uppercase text-amber-400 font-heading">1v1 Solo Duels</h3>
            <ul className="space-y-2 text-xs text-neutral-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Modes</strong>: 1v1 Sniper Only (DL Q33, Locus, Koshka, Arctic.50, Outlaw), Gunfight (All Guns), Shotgun/Melee, Assault/SMG, Hardcore FFA.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Maps</strong>: Shipment, Nuketown, Killhouse, Rust, Firing Range, Standoff.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Standard Default</strong>: Unless mutually agreed otherwise, Sniper Only disallows thermite ammo, secondary pistols, and melee kills.</span>
              </li>
            </ul>
          </div>

          <div className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <h3 className="text-sm font-black uppercase text-emerald-400 font-heading">5v5 Squad (&quot;Squared&quot;) Battles</h3>
            <ul className="space-y-2 text-xs text-neutral-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Modes</strong>: Search &amp; Destroy, Hardpoint, Domination across Standoff, Summit, and Firing Range.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Team Structure</strong>: 10 player slots (5 Team Alpha vs 5 Team Bravo).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span><strong>Example Economics</strong>: At ₦1,000 per player (₦{squadSample.totalPot.toLocaleString()} pot, {squadSample.rakePercentFormatted} rake), each winning teammate receives <strong>₦{squadSample.payoutPerPlayer.toLocaleString()}</strong>.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Commission Schedule */}
      <section id="fees" className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
            <Wallet size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black font-heading text-white uppercase">3. Tiered Commission &amp; Payout Economics</h2>
            <p className="text-xs text-neutral-400">Transparent platform rake that scales down as match stakes increase</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-900 text-neutral-400 uppercase font-mono text-[10px] border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">1v1 Stake / Player</th>
                <th className="px-4 py-3">Total Escrow Pot</th>
                <th className="px-4 py-3">Platform Rake</th>
                <th className="px-4 py-3">Platform Fee</th>
                <th className="px-4 py-3 text-emerald-400">Winner Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70 font-mono">
              {TIERED_COMMISSION_SCHEDULE.map((row) => (
                <tr key={row.stake} className="hover:bg-neutral-900/50">
                  <td className="px-4 py-2.5 text-white font-bold">₦{row.stake.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-neutral-300">₦{row.pot.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-amber-400 font-bold">{row.rakePercentFormatted}</td>
                  <td className="px-4 py-2.5 text-neutral-400">₦{row.platformFee.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-emerald-400 font-bold">₦{row.winnerPayout.toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-neutral-900/40">
                <td className="px-4 py-2.5 text-white font-bold">₦25,000+</td>
                <td className="px-4 py-2.5 text-neutral-300">₦50,000+</td>
                <td className="px-4 py-2.5 text-amber-400 font-bold">4%</td>
                <td className="px-4 py-2.5 text-neutral-400">4% of pot</td>
                <td className="px-4 py-2.5 text-emerald-400 font-bold">96% of total pot</td>
              </tr>
              <tr className="bg-neutral-900/40">
                <td className="px-4 py-2.5 text-white font-bold">₦50,000+</td>
                <td className="px-4 py-2.5 text-neutral-300">₦100,000+</td>
                <td className="px-4 py-2.5 text-amber-400 font-bold">3.5%</td>
                <td className="px-4 py-2.5 text-neutral-400">3.5% of pot</td>
                <td className="px-4 py-2.5 text-emerald-400 font-bold">96.5% of total pot</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-neutral-400">
          <strong>5v5 Squad matches</strong> enjoy a reduced <strong>5% base fee</strong> (3%–4% on larger pots ₦25,000–₦100,000+). Draws always refund <strong>100% of stakes</strong> to all players with zero rake.
        </p>
      </section>

      {/* 4. Verification & Integrity */}
      <section id="integrity" className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Scale size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black font-heading text-white uppercase">4. AI Verification, Disputes &amp; Anti-Fraud Policy</h2>
              <p className="text-xs text-neutral-400">Automated forensics backed by strict no-auto-settlement rules</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateToRules}
            className="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>View Full Rules Page</span>
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-neutral-300">
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
            <h3 className="font-bold text-white uppercase flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-400" />
              AI Scoreboard Forensics
            </h3>
            <p className="text-neutral-400 leading-relaxed">
              Every uploaded scoreboard screenshot is checked for image manipulation, resolution anomalies, detected gamer tags, and match victory/defeat state before payout release.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
            <h3 className="font-bold text-white uppercase flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-400" />
              No Auto-Settlement Policy
            </h3>
            <p className="text-neutral-400 leading-relaxed">
              Expired countdowns or stalled matches never auto-award wins or unilateral refunds. Both players must mutually agree to restart the timer or void/refund 100%, or escalate video proof to moderators.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-950 border border-rose-500/30 space-y-2">
            <h3 className="font-bold text-rose-400 uppercase flex items-center gap-1.5">
              <Zap size={14} />
              Conflict Fraud Strikes
            </h3>
            <p className="text-neutral-400 leading-relaxed">
              False victory claims trigger Strike 1 probation with a 10% conflict penalty fee. Repeat offenders receive permanent bans and escrow forfeiture on disputed pots.
            </p>
          </div>
        </div>
      </section>

      {/* 5. Social, Real-Time Presence & Read Receipts */}
      <section id="social-comms" className="p-6 sm:p-8 rounded-3xl bg-neutral-900 border border-neutral-800 space-y-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black font-heading text-white uppercase">5. Social Network, Real-Time Comms &amp; Win Streaks</h2>
            <p className="text-xs text-neutral-400">WebSocket-powered player presence, read receipts, and competitive streaks</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-neutral-300">
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white">World Chat &amp; Open Room Hosting</h3>
            <p className="text-neutral-400 leading-relaxed">
              Minimalist live World Chat displaying usernames and messages. Sharing an unaccepted challenge posts a direct <strong>Open Room</strong> card so any challenger can enter and stake in one tap.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white">Live Active, Offline &amp; Last Seen Presence</h3>
            <p className="text-neutral-400 leading-relaxed">
              Multi-socket heartbeat tracking shows whether rivals are <strong>Active now</strong>, <strong>Active in Room</strong>, or <strong>Offline with Last Seen timestamp</strong> persisted in PostgreSQL.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white">Sent &amp; Read Receipts + Voice Chat</h3>
            <p className="text-neutral-400 leading-relaxed">
              Both 1v1 Rival Chat and Match Lobby Chat display real-time <strong>Sent</strong> vs <strong>Read</strong> indicators backed by database read timestamps, plus live browser voice chat in match rooms.
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-1.5">
            <h3 className="font-bold text-white">Dynamic Last-5 Win Streak Badges</h3>
            <p className="text-neutral-400 leading-relaxed">
              Match cards and user profiles automatically calculate active win streaks based on each player&apos;s last 5 settled matches.
            </p>
          </div>
        </div>
      </section>

      {/* 6. Google Search & AI Indexing Readiness Hub */}
      <section id="indexing-hub" className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/20 border border-amber-500/40 space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Globe size={20} />
            </div>
            <div>
              <h2 className="text-xl font-black font-heading text-white uppercase">6. Google Search &amp; AI Crawler Indexing Endpoints</h2>
              <p className="text-xs text-neutral-300">Machine-readable files and Google Search Console checklist for OpsSTAKE</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold uppercase">
            <Bot size={12} />
            Crawler Ready
          </span>
        </div>

        <div className="space-y-2">
          {crawlerResources.map((res) => {
            const fullUrl = `${origin}${res.path}`;
            return (
              <div
                key={res.path}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-neutral-950/90 border border-neutral-800"
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <FileText size={13} className="text-amber-400 shrink-0" />
                    <span>{res.label}</span>
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400 truncate mt-0.5">{fullUrl}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopy(fullUrl)}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    {copiedUrl === fullUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedUrl === fullUrl ? 'Copied' : 'Copy URL'}</span>
                  </button>
                  <a
                    href={res.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/30 text-amber-300 text-[11px] font-bold flex items-center gap-1"
                  >
                    <span>Open</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 space-y-2 text-xs text-neutral-300">
          <div className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">
            Steps to Index on Google Search Console
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-neutral-400 leading-relaxed">
            <li>Verify domain ownership in <strong>Google Search Console</strong> for your live domain (e.g. <code>opsstake.online</code>).</li>
            <li>Open <strong>Indexing &rarr; Sitemaps</strong> and submit <code>sitemap.xml</code> (which lists <code>/</code>, <code>/docs</code>, <code>/arena</code>, <code>/leaderboards</code>, <code>/rules</code>, <code>/support</code>, <code>/llms.txt</code>, and <code>/llms-full.txt</code>).</li>
            <li>Use <strong>URL Inspection</strong> on <code>/</code> and <code>/docs</code> to verify Schema.org JSON-LD (<code>WebApplication</code>, <code>Organization</code>, <code>HowTo</code>, <code>FAQPage</code>) and click <strong>Request Indexing</strong>.</li>
            <li>Verify <code>/llms.txt</code> and <code>/llms-full.txt</code> return HTTP <code>200 OK</code> so AI answer engines (ChatGPT Search, Perplexity, Google AI Overviews) accurately cite your platform rules and fee schedule.</li>
          </ol>
        </div>

        <p className="text-[11px] text-neutral-500 border-t border-neutral-800/80 pt-4">
          Disclaimer: Call of Duty: Mobile is a registered trademark of Activision Publishing, Inc. OpsSTAKE operates strictly as an independent esports escrow and matchmaking platform.
        </p>
      </section>
    </article>
  );
};
