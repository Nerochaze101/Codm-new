export interface Transaction {
  id: string;
  type: 'DEPOSIT' | 'ESCROW_LOCK' | 'ESCROW_REFUND' | 'MATCH_WIN_PAYOUT' | 'WITHDRAWAL' | 'REFERRAL_EARNING';
  amount: number;
  description: string;
  timestamp: number;
  matchId?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  codmIgn: string;
  codmUid: string;
  email: string;
  phone: string;
  balance: number;
  escrowBalance: number;
  totalWinnings: number;
  wins: number;
  losses: number;
  draws: number;
  tier?: string;
  clan?: string;
  avatar: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  referredBy?: string;
  referralCode?: string;
  totalReferralEarnings?: number;
  referralCount?: number;
  role?: string;
  telegramChatId?: string;
  telegramUsername?: string;
  transactions: Transaction[];
}

export interface SystemAiDetection {
  isLikelyFake: boolean;
  confidenceScore: number;
  fakeRiskScore: number;
  verdict: string;
  dimensions: { width: number; height: number } | null;
  aspectRatio: string;
  fileType: string;
  fileSizeKb: number;
  headerHex: string;
  isStandardType: boolean;
  detectedSoftware: string | null;
  redFlags: string[];
  positiveSignals: string[];
}

export interface MatchPlayer {
  id: string;
  username: string;
  codmIgn: string;
  codmUid: string;
  avatar: string;
  staked: boolean;
  resultClaim?: 'VICTORY' | 'DEFEAT' | 'DRAW';
  screenshotUrl?: string;
  screenshotAnalysis?: {
    detectedOutcome: 'VICTORY' | 'DEFEAT' | 'DRAW' | 'UNCLEAR';
    confidence: number;
    detectedPlayerName?: string | null;
    scoreSummary?: string;
    reasoning?: string;
  };
  forensicAnalysis?: {
    isLikelyFake: boolean;
    confidenceScore: number;
    aiDetected: boolean;
    manipulationDetected: boolean;
    detectedPlayerName: string;
    detectedOutcome: string;
    technicalNotes: string;
    redFlags: string[];
    verdict: string;
    fileInfo?: any;
  };
  systemAiDetection?: SystemAiDetection;
  resubmissionRequested?: boolean;
  resubmissionReason?: string;
  submittedAt?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export interface SquadSlot {
  slotIndex: number; // 0..9 (0..4 Team Alpha, 5..9 Team Bravo)
  team: 'ALPHA' | 'BRAVO';
  userId?: string;
  username?: string;
  codmIgn?: string;
  codmUid?: string;
  avatar?: string;
  staked: boolean;
  stakedAt?: number;
}

export interface SquadData {
  playersPerTeam: number; // 5
  totalSlots: number; // 10
  stakePerPlayer: number;
  slots: SquadSlot[];
  winningTeam?: 'ALPHA' | 'BRAVO';
  submissionTeamAlpha?: { claim: 'VICTORY' | 'DEFEAT' | 'DRAW'; screenshotUrl?: string; submittedBy?: string };
  submissionTeamBravo?: { claim: 'VICTORY' | 'DEFEAT' | 'DRAW'; screenshotUrl?: string; submittedBy?: string };
}

export interface Match {
  id: string;
  challengeCode: string;
  roomCode?: string; // Generated ONLY when both players / all squad slots have confirmed stake payments
  gameMode: string;
  map: string;
  rules: string[];
  stakeAmount: number;
  potAmount: number;
  platformFeePercentage: number;
  platformFee: number;
  winnerPayout: number;
  matchDurationMinutes?: number;
  matchType?: 'solo' | 'squad';
  squadData?: SquadData;
  status:
    | 'PENDING_OPPONENT_STAKE'
    | 'OPPONENT_STAKED_AWAITING_CREATOR'
    | 'READY_TO_PLAY'
    | 'IN_PROGRESS'
    | 'SUBMITTING_RESULTS'
    | 'VERIFYING'
    | 'SETTLED'
    | 'DISPUTED'
    | 'CANCELLED'
    | 'ABANDONED'
    | 'ABANDONED_AND_SETTLED';
  createdAt: number;
  roomGeneratedAt?: number;
  creator: MatchPlayer;
  opponent?: MatchPlayer;
  winnerId?: string;
  winnerIgn?: string;
  chatMessages: ChatMessage[];
  resolutionNotes?: string;
  conflictReason?: string;
  conflictReasonsList?: string[];
  reviewStatus?: 'PENDING_REVIEW' | 'ESCALATED' | 'RESUBMISSION_REQUESTED' | 'CLEAN';
  resubmissionNotice?: {
    targetPlayerId?: string;
    targetPlayerIgn?: string;
    reason: string;
    timestamp: number;
  };
  isPublic?: boolean;
  conflictRetries?: number;
  creatorScreenshot?: string;
  opponentScreenshot?: string;
}


export interface WithdrawalRequest {
  id: string;
  userId: string;
  codmIgn: string;
  email: string;
  phone: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode?: string;
  status: 'pending' | 'approved' | 'rejected';
  remark: string;
  createdAt: number;
  processedAt?: number;
  processedBy?: string;
  opayRedirectUrl?: string;
  rejectionReason?: string;
  balanceDeducted?: boolean;
  webhookReceived?: boolean;
  webhookPayload?: any;
}

export interface DepositRequest {
  id: string;
  userId: string;
  codmIgn: string;
  amount: number;
  paymentReference: string;
  status: 'pending' | 'completed' | 'expired';
  smsAlertId?: string;
  createdAt: number;
  expiresAt: number;
  completedAt?: number;
}

export interface OpaySmsAlert {
  id: string;
  smsBody: string;
  sender?: string;
  amount: number;
  narration?: string;
  senderName?: string;
  reference?: string;
  matchedUserId?: string;
  matchedUserIgn?: string;
  status: 'auto_credited' | 'manually_credited' | 'unmatched' | 'ignored';
  createdAt: number;
  creditedAt?: number;
}
