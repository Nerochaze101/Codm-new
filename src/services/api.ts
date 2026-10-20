import { Match, UserProfile, Transaction, WithdrawalRequest, DepositRequest, OpaySmsAlert } from '../types';

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
  phone?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
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

export async function testPandascrowConnection() {
  const res = await fetch('/api/pandascrow/test-connection');
  return await res.json();
}

export async function initializePandascrowTransaction(data: {
  userId: string;
  amount: number;
  email?: string;
  name?: string;
  phoneNumber?: string;
}) {
  const res = await fetch('/api/pandascrow/initialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to initialize Pandascrow transaction');
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
  matchDurationMinutes?: number;
  isPublic?: boolean;
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

export async function clearMatchChat(matchId: string) {
  const res = await fetch(`/api/matches/${matchId}/clear-chat`, {
    method: 'POST',
  });
  if (!res.ok) {
    throw new Error('Failed to clear match chat');
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

export async function abandonMatch(matchId: string, reason?: string): Promise<{ success: boolean; match: Match; data: any }> {
  const res = await fetch(`/api/matches/${matchId}/abandon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to settle abandoned match');
  }
  return await res.json();
}

export async function adminAbandonMatch(matchId: string, adminUserId: string, reason?: string): Promise<{ success: boolean; match: Match; data: any }> {
  const res = await fetch(`/api/admin/matches/${matchId}/abandon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to settle abandoned match as admin');
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

export async function cleanUserHistory(userId: string, clearAll: boolean = false): Promise<UserProfile> {
  const res = await fetch(`/api/users/${userId}/clean-history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clearAll }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to clean history');
  }
  const data = await res.json();
  return data.user;
}

export async function fetchAdminWithdrawals(adminUserId: string, status?: string): Promise<WithdrawalRequest[]> {
  const url = status && status !== 'all' 
    ? `/api/admin/withdrawals?userId=${encodeURIComponent(adminUserId)}&status=${encodeURIComponent(status)}`
    : `/api/admin/withdrawals?userId=${encodeURIComponent(adminUserId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch withdrawal requests');
  }
  const data = await res.json();
  return data.withdrawals || [];
}

export async function approveAdminWithdrawal(adminUserId: string, withdrawalId: string) {
  const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to approve withdrawal');
  }
  return await res.json();
}

export async function rejectAdminWithdrawal(adminUserId: string, withdrawalId: string, reason?: string) {
  const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to reject withdrawal');
  }
  return await res.json();
}

export async function fetchAdminUsers(adminUserId: string, search?: string) {
  const url = search 
    ? `/api/admin/users?userId=${encodeURIComponent(adminUserId)}&search=${encodeURIComponent(search)}`
    : `/api/admin/users?userId=${encodeURIComponent(adminUserId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch users');
  }
  const data = await res.json();
  return data.users || [];
}

export async function assignUserRole(adminUserId: string, params: { targetUserId?: string; identifier?: string; role: 'admin' | 'user' }) {
  const res = await fetch('/api/admin/assign-role', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...params }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to assign role');
  }
  return await res.json();
}

export async function claimAdminRole(userId: string, passcode?: string) {
  const res = await fetch('/api/admin/claim-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, passcode }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to claim admin access');
  }
  return await res.json();
}

export async function fetchAdminFinance(adminUserId: string) {
  const res = await fetch(`/api/admin/finance?userId=${encodeURIComponent(adminUserId)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to load platform finance');
  }
  return await res.json();
}

export async function withdrawPlatformFees(adminUserId: string, amount: number) {
  const res = await fetch('/api/admin/withdraw', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId, amount }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to withdraw platform fees');
  }
  return await res.json();
}

export async function adjustUserBalance(adminUserId: string, targetUserId: string, amount: number, type: 'credit' | 'debit', reason: string) {
  const res = await fetch(`/api/admin/users/${targetUserId}/adjust-balance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, amount, type, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to adjust user balance');
  }
  return await res.json();
}

export async function fetchAdminSmsAlerts(adminUserId: string, status?: string) {
  const url = status && status !== 'all'
    ? `/api/admin/sms-alerts?userId=${encodeURIComponent(adminUserId)}&status=${encodeURIComponent(status)}`
    : `/api/admin/sms-alerts?userId=${encodeURIComponent(adminUserId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch SMS alerts');
  }
  const data = await res.json();
  return data.alerts || [];
}

export async function assignSmsAlertToUser(adminUserId: string, alertId: string, targetUserId: string) {
  const res = await fetch(`/api/admin/sms-alerts/${alertId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, targetUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to assign SMS alert');
  }
  return await res.json();
}

export async function createDepositRequest(userId: string, amount: number): Promise<{
  deposit: DepositRequest;
  accountDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
    amount: number;
    paymentReference: string;
    instructions: string;
  };
}> {
  const res = await fetch('/api/deposits/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, amount }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create deposit request');
  }
  return await res.json();
}

export async function checkDepositStatus(depositId: string): Promise<{
  id: string;
  status: 'pending' | 'completed' | 'expired';
  completed: boolean;
  amount: number;
  paymentReference: string;
  balance: number;
  completedAt?: number;
}> {
  const res = await fetch(`/api/deposits/${depositId}/status`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to check deposit status');
  }
  return await res.json();
}

export async function fetchAdminOpaySettings(adminUserId: string): Promise<{
  webhookUrl: string;
  secretKey: string;
  accountDetails: {
    bankName: string;
    accountNumber: string;
    accountName: string;
  };
  stats: {
    totalAlerts: number;
    autoCredited: number;
    unmatched: number;
    totalCreditedAmount: number;
  };
}> {
  const res = await fetch(`/api/admin/opay/settings?userId=${encodeURIComponent(adminUserId)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to load OPay settings');
  }
  return await res.json();
}

// ==========================================
// 📧 GMAIL & ADMIN MAILBOX API CLIENT
// ==========================================

export interface GmailIntegrationStatus {
  configured: boolean;
  gmailAddress: string | null;
  autoSync: boolean;
  lastSyncedAt: number | null;
  lastSyncStatus: 'idle' | 'success' | 'error' | 'syncing';
  lastSyncError: string | null;
  totalEmailsSynced: number;
  hasEnvOverride: boolean;
}

export interface AdminEmailItem {
  id: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  folder: string;
  isRead: boolean;
  createdAt: number;
  isVerified?: boolean;
  verifiedAt?: number;
}

export async function fetchGmailConfig(adminUserId: string): Promise<GmailIntegrationStatus> {
  const res = await fetch(`/api/admin/gmail/config?userId=${encodeURIComponent(adminUserId)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch Gmail status');
  }
  return await res.json();
}

export async function saveGmailCredentials(
  adminUserId: string,
  gmailAddress: string,
  appPassword: string,
  autoSync: boolean = true
) {
  const res = await fetch('/api/admin/gmail/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId, gmailAddress, appPassword, autoSync }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to connect Gmail');
  }
  return await res.json();
}

export async function testGmailApiConnection(
  adminUserId: string,
  gmailAddress?: string,
  appPassword?: string
) {
  const res = await fetch('/api/admin/gmail/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId, gmailAddress, appPassword }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Connection test failed');
  }
  return await res.json();
}

export async function triggerGmailSync(adminUserId: string) {
  const res = await fetch('/api/admin/gmail/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to sync Gmail');
  }
  return await res.json();
}

export async function disconnectGmailAccount(adminUserId: string) {
  const res = await fetch('/api/admin/gmail/disconnect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to disconnect Gmail');
  }
  return await res.json();
}

export async function fetchAdminMailbox(adminUserId: string): Promise<AdminEmailItem[]> {
  const res = await fetch(`/api/admin/mailbox?userId=${encodeURIComponent(adminUserId)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to fetch mailbox');
  }
  const data = await res.json();
  return data.emails || data.messages || [];
}

export async function markAdminEmailRead(adminUserId: string, emailId: string, isRead: boolean = true) {
  const res = await fetch(`/api/admin/mailbox/${emailId}/read`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId, isRead }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to update email status');
  }
  return await res.json();
}

export async function deleteAdminEmail(adminUserId: string, emailId: string) {
  const res = await fetch(`/api/admin/mailbox/${emailId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to delete email');
  }
  return await res.json();
}

export async function cleanupVerifiedAdminMails(adminUserId: string): Promise<{ success: boolean; count: number; message: string }> {
  const res = await fetch('/api/admin/mailbox/cleanup-verified', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: adminUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to clean up verified emails');
  }
  return await res.json();
}

export async function verifyDepositSession(depositId: string, userId: string, sessionReference: string, bankName?: string, accountNumber?: string, accountName?: string) {
  const res = await fetch('/api/deposits/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ depositId, userId, sessionReference, bankName, accountNumber, accountName }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to verify deposit session');
  }
  return await res.json();
}




