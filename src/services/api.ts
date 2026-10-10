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
}

export async function signInUser(data: {
  identifier: string;
  password?: string;
}): Promise<UserProfile> {
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
}

export async function createUser(data: Partial<UserProfile> & { initialDeposit?: number }): Promise<UserProfile> {
  const res = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (res.ok) {
    return await res.json();
  } else {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create user');
  }
}

export async function depositWallet(
  userId: string,
  amount: number,
  method: string,
  reference?: string,
  transactionId?: string | number
) {
  const res = await fetch(`/api/users/${userId}/deposit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, method, reference, transactionId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to deposit funds');
  }
  return await res.json();
}

export async function withdrawWallet(
  userId: string,
  amount: number,
  bankDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    bankCode?: string;
    gateway?: 'flutterwave' | 'paystack';
  }
) {
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

export async function testFlutterwaveConnection() {
  const res = await fetch('/api/flutterwave/test-connection');
  return await res.json();
}

export async function testPaystackConnection() {
  const res = await fetch('/api/paystack/test-connection');
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
