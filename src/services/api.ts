import { Match, UserProfile, Transaction } from '../types';

export const DEFAULT_USERS: Record<string, UserProfile> = {};

export async function fetchUser(userId: string): Promise<UserProfile> {
  const res = await fetch(`/api/users/${userId}`);
  if (res.ok) return await res.json();
  throw new Error('User not found');
}

export async function signUpUser(data: {
  email: string;
  password?: string;
  codmIgn: string;
  codmUid: string;
  initialDeposit?: number;
}): Promise<UserProfile> {
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return await res.json();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'Failed to sign up');
    }
  } catch (e: any) {
    if (e.message && e.message !== 'Failed to fetch') {
      throw e;
    }
  }

  // Fallback client-side creation
  const id = `user_${Date.now()}`;
  const numDeposit = Math.max(0, data.initialDeposit || 0);
  const newUser: UserProfile = {
    id,
    username: data.codmIgn.trim(),
    codmIgn: data.codmIgn.trim(),
    codmUid: data.codmUid.trim(),
    email: data.email.trim(),
    phone: '+234 800 000 0000',
    balance: numDeposit,
    escrowBalance: 0,
    totalWinnings: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(data.codmIgn.trim())}`,
    transactions: numDeposit > 0 ? [
      {
        id: `tx_${Date.now()}`,
        type: 'DEPOSIT',
        amount: numDeposit,
        description: `Initial funding ₦${numDeposit.toLocaleString()}`,
        timestamp: Date.now(),
      }
    ] : [],
  };
  DEFAULT_USERS[id] = newUser;
  return newUser;
}

export async function signInUser(data: {
  identifier: string;
  password?: string;
}): Promise<UserProfile> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      return await res.json();
    } else {
      const err = await res.json();
      throw new Error(err.error || 'Failed to sign in');
    }
  } catch (e: any) {
    if (e.message && e.message !== 'Failed to fetch') {
      throw e;
    }
  }

  // Client-side fallback: check in DEFAULT_USERS
  const clean = data.identifier.trim().toLowerCase();
  const found = Object.values(DEFAULT_USERS).find(
    (u) => u.email.toLowerCase() === clean || u.codmIgn.toLowerCase() === clean
  );
  if (found) return found;

  throw new Error('Account not found. Please check your credentials or create a new account.');
}

export async function createUser(data: Partial<UserProfile> & { initialDeposit?: number }): Promise<UserProfile> {
  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  const id = `user_${Date.now()}`;
  const newUser: UserProfile = {
    id,
    username: data.username || data.codmIgn || 'Gamer',
    codmIgn: data.codmIgn || 'CODM_Ace',
    codmUid: data.codmUid || `67${Math.floor(10000000000000 + Math.random() * 90000000000000)}`,
    email: data.email || 'player@esports.ng',
    phone: data.phone || '+234 800 000 0000',
    balance: data.initialDeposit || 0,
    escrowBalance: 0,
    totalWinnings: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${data.codmIgn}`,
    transactions: data.initialDeposit ? [
      {
        id: `tx_${Date.now()}`,
        type: 'DEPOSIT',
        amount: data.initialDeposit,
        description: `Initial funding ₦${data.initialDeposit.toLocaleString()}`,
        timestamp: Date.now(),
      }
    ] : [],
  };
  return newUser;
}

export async function depositWallet(userId: string, amount: number, method: string) {
  const res = await fetch(`/api/users/${userId}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, method }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to deposit funds');
  }
  return await res.json();
}

export async function withdrawWallet(userId: string, amount: number, bankDetails: { bankName: string; accountNumber: string; accountName: string }) {
  const res = await fetch(`/api/users/${userId}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, ...bankDetails }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to process withdrawal');
  }
  return await res.json();
}

export async function fetchMatches(): Promise<Match[]> {
  try {
    const res = await fetch('/api/matches');
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return [];
}

export async function fetchMatch(matchId: string): Promise<Match> {
  const res = await fetch(`/api/matches/${matchId}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Match not found');
  }
  return await res.json();
}

export async function createMatch(data: {
  creatorId: string;
  stakeAmount: number;
  gameMode?: string;
  map?: string;
  rules?: string[];
}): Promise<Match> {
  const res = await fetch('/api/matches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create match wager');
  }
  return await res.json();
}

export async function joinMatch(matchId: string, opponentId: string): Promise<Match> {
  const res = await fetch(`/api/matches/${matchId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ opponentId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to join match');
  }
  return await res.json();
}

export async function opponentStakeMatch(
  matchId: string,
  payload: { opponentId: string; paymentMethod?: string }
): Promise<Match> {
  const res = await fetch(`/api/matches/${matchId}/opponent-stake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to lock opponent stake in escrow');
  }
  return await res.json();
}

export async function creatorStakeMatch(
  matchId: string,
  payload: { creatorId: string; paymentMethod?: string }
): Promise<Match> {
  const res = await fetch(`/api/matches/${matchId}/creator-stake`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to lock matching host stake in escrow');
  }
  return await res.json();
}

export async function sendMatchChat(matchId: string, senderId: string, text: string) {
  const res = await fetch(`/api/matches/${matchId}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ senderId, text }),
  });
  if (!res.ok) {
    throw new Error('Failed to send message');
  }
  return await res.json();
}

export async function cancelMatch(matchId: string): Promise<Match> {
  const res = await fetch(`/api/matches/${matchId}/cancel`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to cancel match');
  }
  return await res.json();
}

export async function submitMatchResult(matchId: string, payload: {
  playerId: string;
  claim: 'VICTORY' | 'DEFEAT' | 'DRAW';
  screenshotBase64?: string;
}): Promise<Match> {
  const res = await fetch(`/api/matches/${matchId}/submit-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to submit match screenshot');
  }
  return await res.json();
}

export async function updateUser(userId: string, data: Partial<UserProfile>): Promise<UserProfile> {
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    console.error('Failed to update user via API:', e);
  }
  return { ...DEFAULT_USERS[userId], ...data } as UserProfile;
}

export async function adminResolveMatch(matchId: string, winnerId: string): Promise<Match> {
  const res = await fetch(`/api/matches/${matchId}/admin-resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ winnerId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to resolve match');
  }
  return await res.json();
}
