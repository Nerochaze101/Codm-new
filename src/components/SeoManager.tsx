import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteSeoMeta {
  title: string;
  description: string;
  indexable: boolean;
}

const DEFAULT_SEO: RouteSeoMeta = {
  title: 'OpsSTAKE – Tactical Mobile Shooter Esports Escrow Arena',
  description:
    'Secure 1v1 & 5v5 tactical mobile shooter wagering platform in Nigerian Naira (₦) with automated escrow, AI scoreboard verification, and instant payouts.',
  indexable: true,
};

const ROUTE_SEO_MAP: Record<string, RouteSeoMeta> = {
  '/': DEFAULT_SEO,
  '/docs': {
    title: 'OpsSTAKE Documentation – Escrow, Rules & Search Guide',
    description:
      'Complete documentation for OpsSTAKE: 2-step escrow staking, tiered commission fees, AI scoreboard verification, fair play protocols, and indexing endpoints.',
    indexable: true,
  },
  '/arena': {
    title: 'Battle Arena & World Chat – OpsSTAKE 1v1 Esports',
    description:
      'Browse live 1v1 and 5v5 mobile shooter escrow challenges, join World Chat, challenge active rivals, and lock stakes safely in the OpsSTAKE Battle Arena.',
    indexable: true,
  },
  '/leaderboards': {
    title: 'Global Leaderboards & Top Earners – OpsSTAKE Arena',
    description:
      'Explore top ranked mobile shooter duelists on OpsSTAKE by total Naira (₦) winnings, win count, and win streak tiers.',
    indexable: true,
  },
  '/rules': {
    title: 'Arena Rules, Loadouts & Escrow Protocol – OpsSTAKE',
    description:
      'Official OpsSTAKE tournament rules: 2-step escrow locking, allowed sniper loadouts, AI scoreboard verification, mutual stalled-match rules, and penalty tiers.',
    indexable: true,
  },
  '/support': {
    title: '24/7 Player Support & Dispute Help – OpsSTAKE',
    description:
      'Contact OpsSTAKE 24/7 support for instant assistance with deposits, Nigerian bank withdrawals, match disputes, and account help.',
    indexable: true,
  },
  '/auth': {
    title: 'Sign In or Create Account – OpsSTAKE Esports Arena',
    description: 'Sign in or register your OpsSTAKE profile to stake 1v1 duels and claim instant Nigerian Naira payouts.',
    indexable: false,
  },
  '/wallet': {
    title: 'Wallet & Bank Withdrawals – OpsSTAKE',
    description: 'Manage your OpsSTAKE Naira wallet balance, deposits, escrow locks, and instant Nigerian bank withdrawals.',
    indexable: false,
  },
  '/profile': {
    title: 'Player Profile & Stats – OpsSTAKE',
    description: 'View your OpsSTAKE win/loss record, Win Streak badge, bank payout details, and referral code.',
    indexable: false,
  },
  '/history': {
    title: 'Match History & Settlement Ledger – OpsSTAKE',
    description: 'Review your recent settled and disputed esports wagers on OpsSTAKE.',
    indexable: false,
  },
  '/social': {
    title: 'Rivals Roster & 1v1 Encrypted Chat – OpsSTAKE',
    description: 'Search rivals, see online/last seen presence, message with read receipts, and launch direct 1v1 challenges.',
    indexable: false,
  },
  '/disputes': {
    title: 'Dispute Resolution Center – OpsSTAKE',
    description: 'Submit match scoreboard or video evidence for moderator review on OpsSTAKE.',
    indexable: false,
  },
  '/referrals': {
    title: 'Referral Program & Commissions – OpsSTAKE',
    description: 'Invite fellow players to OpsSTAKE and track your referral earnings.',
    indexable: false,
  },
  '/msksksnuwje': {
    title: 'Operations Console – OpsSTAKE',
    description: 'Restricted staff operations portal.',
    indexable: false,
  },
};

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export const SeoManager: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    const cleanPath = location.pathname === '/' ? '/' : location.pathname.replace(/\/+$/, '');
    const meta = ROUTE_SEO_MAP[cleanPath] || DEFAULT_SEO;
    const canonicalUrl = `${window.location.origin}${cleanPath === '/' ? '/' : cleanPath}`;

    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta(
      'name',
      'robots',
      meta.indexable
        ? 'index, follow, max-image-preview:large, max-snippet:-1'
        : 'noindex, nofollow'
    );
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    upsertMeta('property', 'og:url', canonicalUrl);
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'twitter:url', canonicalUrl);
    upsertCanonical(canonicalUrl);
  }, [location.pathname]);

  return null;
};
