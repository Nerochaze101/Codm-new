import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, SupportMessage } from '../types';
import { io, Socket } from 'socket.io-client';
import {
  ShieldCheck,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  Search,
  RefreshCw,
  UserCheck,
  Users,
  AlertCircle,
  Mail,
  Wallet,
  Sparkles,
  Zap,
  TrendingUp,
  Coins,
  History as HistoryIcon,
  ArrowUpRight,
  PlusCircle,
  MinusCircle,
  X,
  Inbox,
  Key,
  Check,
  ExternalLink,
  Eye,
  Trash2,
  Settings,
  Loader2,
  Shield,
  Target,
  Send,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Filter,
  ZoomIn,
  Camera,
  Maximize2,
  ShieldAlert,
  Handshake,
  Lock,
  Copy,
  Headphones,
  MessageCircle,
  Megaphone,
  ClipboardList
} from 'lucide-react';
import {
  fetchAdminUsers,
  assignUserRole,
  claimAdminRole,
  fetchAdminFinance,
  withdrawPlatformFees,
  adjustUserBalance,
  fetchGmailConfig,
  saveGmailCredentials,
  testGmailApiConnection,
  triggerGmailSync,
  disconnectGmailAccount,
  fetchAdminMailbox,
  markAdminEmailRead,
  deleteAdminEmail,
  cleanupVerifiedAdminMails,
  fetchAdminDisputes,
  fetchReviewQueue,
  adminResubmitMatch,
  adminEscalateMatch,
  adminAbandonMatch,
  analyzeScreenshotForensic,
  adminResolveMatch,
  fetchFlaggedAccounts,
  dismissAccountFlag,
  banDuplicateAccount,
  unbanAccount,
  claimMatchReview,
  deleteUser,
  fetchMaintenanceStatus,
  updateMaintenanceMode,
  fetchAdminAuditLogs,
  AdminAuditLog,
  GmailIntegrationStatus,
  AdminEmailItem,
  FlaggedAccountItem,
} from '../services/api';
import { Match } from '../types';

interface AdminDashboardProps {
  currentUser: UserProfile;
  onRefreshUser?: () => void;
}

interface FeeFundingMatch {
  id: string;
  challengeCode: string;
  gameMode: string;
  map: string;
  stakeAmount: number;
  potAmount: number;
  platformFee: number;
  grossPlatformFee?: number;
  referralDeducted?: number;
  winnerIgn: string;
  settledAt: number;
}

interface FeeWithdrawalRecord {
  id: string;
  amount: number;
  description: string;
  timestamp: number;
}

interface AdminFinanceData {
  total_fees_collected: number;
  total_fees_withdrawn: number;
  available_fees: number;
  recent_fee_matches?: FeeFundingMatch[];
  recent_withdrawals?: FeeWithdrawalRecord[];
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onRefreshUser }) => {
  const [activeTab, setActiveTab] = useState<'review_queue' | 'finance' | 'users' | 'gmail' | 'disputes' | 'multi_accounts' | 'broadcast' | 'audit_logs' | 'maintenance' | 'support'>('review_queue');
  const [flaggedAccounts, setFlaggedAccounts] = useState<FlaggedAccountItem[]>([]);
  const [multiAccountClusters, setMultiAccountClusters] = useState<any[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState<boolean>(false);
  const [auditCategory, setAuditCategory] = useState<string>('ALL');
  const [auditSearch, setAuditSearch] = useState<string>('');

  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const logs = await fetchAdminAuditLogs(currentUser.id, auditSearch, auditCategory);
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  // Review Queue Moderation state
  const [reviewQueueMatches, setReviewQueueMatches] = useState<Match[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueFilter, setQueueFilter] = useState<'all' | 'disputed' | 'ai_flagged' | 'resubmit'>('all');
  const [queueSearch, setQueueSearch] = useState('');
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const handleCopyTag = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTag(id);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // 1. Approve Payout Action Modal state
  const [payoutModal, setPayoutModal] = useState<{
    isOpen: boolean;
    match: Match | null;
    selectedWinnerId: string;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    match: null,
    selectedWinnerId: '',
    isSubmitting: false,
    error: null,
  });

  // 2. Reject & Request Resubmission Action Modal state
  const [resubmitModal, setResubmitModal] = useState<{
    isOpen: boolean;
    match: Match | null;
    targetPlayerId: string;
    reason: string;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    match: null,
    targetPlayerId: 'both',
    reason: 'Screenshot proof rejected. Please upload an unedited full-screen CODM landscape scoreboard.',
    isSubmitting: false,
    error: null,
  });

  // 3. Escalate to Manual Review Action Modal state
  const [escalateModal, setEscalateModal] = useState<{
    isOpen: boolean;
    match: Match | null;
    reason: string;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    match: null,
    reason: 'Scoreboard discrepancy or synthetic AI image indicators detected. Escalated for forensic referee audit.',
    isSubmitting: false,
    error: null,
  });

  // Lightbox Inspection Modal for full-resolution view with zoom
  const [lightboxData, setLightboxData] = useState<{
    url: string;
    playerIgn: string;
    role: string;
    matchCode: string;
    systemAi?: any;
  } | null>(null);

  // Platform Fee Treasury state
  const [finance, setFinance] = useState<AdminFinanceData | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);
  const [withdrawErrorMsg, setWithdrawErrorMsg] = useState<string | null>(null);

  // Platform Fee Rate Configuration state (1v1 vs 5v5 Squad)
  const [soloFeeRate, setSoloFeeRate] = useState<number>(10);
  const [squadFeeRate, setSquadFeeRate] = useState<number>(5);
  const [isSavingFees, setIsSavingFees] = useState(false);
  const [feeSaveMsg, setFeeSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Maintenance Mode state
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [isTogglingMaintenance, setIsTogglingMaintenance] = useState(false);

  // Global Broadcast Banner state
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastType, setBroadcastType] = useState<'info' | 'warning' | 'urgent' | 'success'>('warning');
  const [isPublishingBroadcast, setIsPublishingBroadcast] = useState(false);
  const [broadcastStatusMsg, setBroadcastStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [currentActiveBroadcast, setCurrentActiveBroadcast] = useState<any>(null);
  const [activeBroadcasts, setActiveBroadcasts] = useState<any[]>([]);

  const loadActiveBroadcast = async () => {
    try {
      const res = await fetch('/api/broadcast');
      const data = await res.json();
      if (data && Array.isArray(data.broadcasts)) {
        setActiveBroadcasts(data.broadcasts);
        setCurrentActiveBroadcast(data.broadcasts[0] || null);
      } else {
        setActiveBroadcasts([]);
        setCurrentActiveBroadcast(null);
      }
    } catch (err) {
      console.error('Failed to load active broadcast:', err);
    }
  };

  const handlePublishBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setIsPublishingBroadcast(true);
    setBroadcastStatusMsg(null);
    try {
      const res = await fetch('/api/msksksnuwje/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Id': currentUser.id,
          'X-User-Id': currentUser.id
        },
        body: JSON.stringify({ message: broadcastText.trim(), type: broadcastType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish broadcast');
      setBroadcastStatusMsg({ type: 'success', text: data.message || 'Published broadcast live!' });
      setBroadcastText('');
      await loadActiveBroadcast();
      setTimeout(() => setBroadcastStatusMsg(null), 4000);
    } catch (err: any) {
      setBroadcastStatusMsg({ type: 'error', text: err.message || 'Failed to publish broadcast' });
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  const handleClearBroadcast = async (bcastId?: string) => {
    setIsPublishingBroadcast(true);
    setBroadcastStatusMsg(null);
    try {
      const endpoint = bcastId && typeof bcastId === 'string' ? `/api/msksksnuwje/broadcast/${bcastId}` : '/api/msksksnuwje/broadcast';
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'X-Admin-Id': currentUser.id,
          'X-User-Id': currentUser.id
        },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear broadcast');
      setBroadcastStatusMsg({ type: 'success', text: data.message || 'Updated broadcasts' });
      await loadActiveBroadcast();
      setTimeout(() => setBroadcastStatusMsg(null), 4000);
    } catch (err: any) {
      setBroadcastStatusMsg({ type: 'error', text: err.message || 'Failed to clear broadcast' });
    } finally {
      setIsPublishingBroadcast(false);
    }
  };

  // Standardized Support Helpdesk State
  const [supportConversations, setSupportConversations] = useState<SupportMessage[]>([]);
  const [selectedSupportUserId, setSelectedSupportUserId] = useState<string | null>(null);
  const [activeThreadMessages, setActiveThreadMessages] = useState<SupportMessage[]>([]);
  const [loadingSupport, setLoadingSupport] = useState<boolean>(false);
  const [loadingThread, setLoadingThread] = useState<boolean>(false);
  const [supportSearch, setSupportSearch] = useState<string>('');
  const [supportCategoryFilter, setSupportCategoryFilter] = useState<string>('all');
  const [supportStatusFilter, setSupportStatusFilter] = useState<string>('all');
  const [composerText, setComposerText] = useState<string>('');
  const [copiedSupportUserId, setCopiedSupportUserId] = useState<boolean>(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  const normalizeAdminSupportMsg = (m: any): SupportMessage => ({
    id: m.id || `sup_${Date.now()}`,
    userId: m.userId || m.user_id,
    senderName: m.senderName || m.sender_name || 'User',
    senderRole: m.senderRole || m.sender_role || 'user',
    text: m.text || '',
    category: m.category || 'General Inquiry',
    room: m.room || `support_user_${m.userId || m.user_id}`,
    status: m.status || 'open',
    timestamp: typeof m.timestamp === 'string' ? Number(m.timestamp) : (Number(m.timestamp) || Date.now()),
    playerName: m.playerName || m.player_name || (m.senderRole === 'user' ? (m.senderName || m.sender_name) : undefined)
  } as any);

  const loadSupportThread = async (targetUid: string) => {
    if (!targetUid) return;
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/support/messages?userId=${targetUid}`);
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        setActiveThreadMessages(data.messages.map(normalizeAdminSupportMsg));
        setTimeout(() => {
          threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      console.error('Failed to load support conversation thread:', err);
    } finally {
      setLoadingThread(false);
    }
  };

  const handleSendSupportReply = async () => {
    if (!selectedSupportUserId || !composerText.trim()) return;

    const textToSend = composerText.trim();
    setComposerText('');

    const activeConv = supportConversations.find(c => (c.userId || (c as any).user_id) === selectedSupportUserId);
    const targetRoom = activeConv?.room || `support_user_${selectedSupportUserId}`;
    const senderName = currentUser.codmIgn || currentUser.username || 'Admin Support';
    const replyId = `rep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const timestamp = Date.now();

    const replyPayload = {
      id: replyId,
      userId: selectedSupportUserId,
      senderName,
      senderRole: currentUser.role || 'admin',
      text: textToSend,
      category: activeConv?.category || 'General Inquiry',
      room: targetRoom,
      targetRoom,
      timestamp,
      status: 'open' as const,
      playerName: (activeConv as any)?.playerName || activeConv?.senderName || 'Player'
    };

    // 1. Send via WebSocket immediately
    if (socketRef.current) {
      socketRef.current.emit('support_message', replyPayload);
    }

    // 2. Optimistically append to active thread
    const normalizedReply = normalizeAdminSupportMsg(replyPayload);
    setActiveThreadMessages(prev => [...prev, normalizedReply]);
    setTimeout(() => {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    // 3. Update conversation roster (move active user to top with latest reply)
    setSupportConversations(prev => {
      const filtered = prev.filter(c => (c.userId || (c as any).user_id) !== selectedSupportUserId);
      return [normalizedReply, ...filtered];
    });

    // 4. Persist to REST API
    try {
      await fetch('/api/support/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(replyPayload)
      });
    } catch (err) {
      console.error('Failed to post support reply to server:', err);
    }
  };

  // Disputes Hub state
  const [disputesList, setDisputesList] = useState<Match[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Match | null>(null);

  // Users & Role Management state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'moderator' | 'user'>('all');
  const [assignIdentifier, setAssignIdentifier] = useState('');
  const [assignRoleType, setAssignRoleType] = useState<'admin' | 'moderator' | 'user'>('admin');
  const [assignMsg, setAssignMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [grantModal, setGrantModal] = useState({
    isOpen: false,
    identifier: "",
    role: "admin" as "admin" | "moderator" | "user",
    submitting: false,
    message: null as string | null,
    error: null as string | null,
  });
  const [isAssigning, setIsAssigning] = useState(false);

  // Gmail & Mailbox State
  const [gmailStatus, setGmailStatus] = useState<GmailIntegrationStatus | null>(null);
  const [emailsList, setEmailsList] = useState<AdminEmailItem[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailSyncMsg, setGmailSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [emailViewerModal, setEmailViewerModal] = useState<AdminEmailItem | null>(null);
  const [emailSearch, setEmailSearch] = useState('');
  const [emailFilter, setEmailFilter] = useState<'all' | 'unread' | 'alerts'>('all');
  const [showHowToHelp, setShowHowToHelp] = useState(false);
  const [cleaningVerifiedMails, setCleaningVerifiedMails] = useState(false);

  // Connect Gmail Form state
  const [gmailForm, setGmailForm] = useState({
    address: '',
    password: '',
    autoSync: true,
    isSubmitting: false,
    error: null as string | null,
    success: null as string | null,
  });

  // User Balance Adjustment Modal
  const [balanceModal, setBalanceModal] = useState<{
    isOpen: boolean;
    user: any | null;
    amount: string;
    type: 'credit' | 'debit';
    reason: string;
    isSubmitting: boolean;
    error: string | null;
  }>({
    isOpen: false,
    user: null,
    amount: '',
    type: 'credit',
    reason: '',
    isSubmitting: false,
    error: null,
  });

  // Telegram Diagnostic State
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramTestMsg, setTelegramTestMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleTelegramTest = async () => {
    setTelegramTesting(true);
    setTelegramTestMsg(null);
    try {
      const res = await fetch('/api/telegram/test-channel-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Id': currentUser.id, 'X-User-Id': currentUser.id },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.success) {
        setTelegramTestMsg({ type: 'success', text: data.message || 'Telegram post successful!' });
      } else {
        setTelegramTestMsg({ type: 'error', text: data.error || 'Telegram post failed' });
      }
    } catch (err: any) {
      setTelegramTestMsg({ type: 'error', text: 'Network error testing Telegram' });
    } finally {
      setTelegramTesting(false);
    }
  };

  // Flutterwave Payout Diagnostics State
  const [flwTestLoading, setFlwTestLoading] = useState(false);
  const [flwTestResult, setFlwTestResult] = useState<any | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);

  const handleRunFlwTest = async () => {
    setFlwTestLoading(true);
    setFlwTestResult(null);
    try {
      const res = await fetch('/api/msksksnuwje/test-cashout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Id': currentUser.id,
          'X-User-Id': currentUser.id,
        },
        body: JSON.stringify({
          amount: 100,
          bankName: 'OPay',
          accountNumber: '9151609682',
          accountName: 'NURUDEEN BOLAJI ABDULSALAM',
          bankCode: '100004',
          gateway: 'flutterwave'
        })
      });
      const data = await res.json();
      setFlwTestResult(data);
    } catch (err: any) {
      setFlwTestResult({ error: err.message || 'Network error running payout test' });
    } finally {
      setFlwTestLoading(false);
    }
  };

  // Server IP Diagnostics State
  const [serverIp, setServerIp] = useState<string>('34.34.246.125');
  const [serverIpLoading, setServerIpLoading] = useState<boolean>(false);

  const loadServerIp = async () => {
    setServerIpLoading(true);
    try {
      const res = await fetch('/api/server-ip');
      const data = await res.json();
      if (data.ip) setServerIp(data.ip);
    } catch (err) {
      console.warn('Could not load dynamic server IP, using default:', err);
    } finally {
      setServerIpLoading(false);
    }
  };

  // Passcode claim for unassigned admin
  const [adminPasscode, setAdminPasscode] = useState('');
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const loadFinance = async () => {
    try {
      const data = await fetchAdminFinance(currentUser.id);
      setFinance(data);
    } catch (e) {
      console.error('Error loading platform finance:', e);
    }
  };

  const loadFeeSettings = async () => {
    try {
      const res = await fetch('/api/admin/fee-settings', {
        headers: { 'X-Admin-Id': currentUser.id, 'X-User-Id': currentUser.id }
      });
      const data = await res.json();
      if (data.soloFeePercent) setSoloFeeRate(data.soloFeePercent);
      if (data.squadFeePercent) setSquadFeeRate(data.squadFeePercent);
    } catch (e) {
      console.error('Error loading fee settings:', e);
    }
  };

  const loadMaintenanceStatus = async () => {
    try {
      const data = await fetchMaintenanceStatus();
      setMaintenanceEnabled(data.maintenanceMode);
    } catch (e) {
      console.error('Error loading maintenance status:', e);
    }
  };

  const handleToggleMaintenance = async (enabled: boolean) => {
    setIsTogglingMaintenance(true);
    try {
      const res = await updateMaintenanceMode(currentUser.id, enabled);
      setMaintenanceEnabled(res.maintenanceMode);
      if (enabled) {
        alert("Maintenance Mode ENABLED. Only admins can access the app.");
      } else {
        alert("Maintenance Mode DISABLED. Public access restored.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to toggle maintenance mode");
    } finally {
      setIsTogglingMaintenance(false);
    }
  };

  const handleSaveFeeSettings = async () => {
    setIsSavingFees(true);
    setFeeSaveMsg(null);
    try {
      const res = await fetch('/api/admin/fee-settings', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Id': currentUser.id,
          'X-User-Id': currentUser.id
        },
        body: JSON.stringify({
          userId: currentUser.id,
          soloFeePercent: soloFeeRate,
          squadFeePercent: squadFeeRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update fee rates');
      setFeeSaveMsg({ type: 'success', text: `Saved! 1v1 Solo: ${data.soloFeePercent}%, 5v5 Squad: ${data.squadFeePercent}%` });
      setTimeout(() => setFeeSaveMsg(null), 4000);
    } catch (err: any) {
      setFeeSaveMsg({ type: 'error', text: err.message || 'Error updating fee rates' });
    } finally {
      setIsSavingFees(false);
    }
  };

  const loadUsers = async () => {
    try {
      const list = await fetchAdminUsers(currentUser.id, usersSearch);
      setUsersList(list);
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  const loadGmail = async () => {
    try {
      setEmailsLoading(true);
      const [status, mails] = await Promise.all([
        fetchGmailConfig(currentUser.id),
        fetchAdminMailbox(currentUser.id),
      ]);
      setGmailStatus(status);
      setEmailsList(mails);
    } catch (e) {
      console.error('Error loading Gmail data:', e);
    } finally {
      setEmailsLoading(false);
    }
  };

  const loadDisputes = async () => {
    try {
      const list = await fetchAdminDisputes(currentUser.id);
      setDisputesList(list);
    } catch (e) {
      console.error('Error loading disputes:', e);
    }
  };

  const loadSupportMessages = async () => {
    setLoadingSupport(true);
    try {
      const res = await fetch('/api/support/admin/messages', {
        headers: { 'X-Admin-Id': currentUser.id }
      });
      const data = await res.json();
      if (data && Array.isArray(data.messages)) {
        const conversations = data.messages.map(normalizeAdminSupportMsg);
        setSupportConversations(conversations);
        if (conversations.length > 0) {
          setSelectedSupportUserId(prev => {
            const initialId = prev || conversations[0].userId;
            loadSupportThread(initialId);
            return initialId;
          });
        }
      }
    } catch (err) {
      console.error('Failed to load support messages:', err);
    } finally {
      setLoadingSupport(false);
    }
  };

  const loadReviewQueue = async () => {
    try {
      setQueueLoading(true);
      const res = await fetchReviewQueue(currentUser.id);
      setReviewQueueMatches(res.matches || []);
    } catch (e) {
      console.error('Error loading review queue:', e);
    } finally {
      setQueueLoading(false);
    }
  };

  const loadFlaggedAccounts = async () => {
    try {
      setFlaggedLoading(true);
      const res = await fetchFlaggedAccounts(currentUser.id);
      setFlaggedAccounts(res.flaggedUsers || []);
      setMultiAccountClusters(res.clusters || []);
    } catch (e) {
      console.error('Error loading flagged accounts:', e);
    } finally {
      setFlaggedLoading(false);
    }
  };

  const reloadAll = async () => {
    setRefreshing(true);
    if (currentUser.role === 'moderator') {
      await Promise.all([loadDisputes(), loadReviewQueue()]);
    } else {
      await Promise.all([loadFinance(), loadUsers(), loadGmail(), loadDisputes(), loadReviewQueue(), loadFeeSettings(), loadFlaggedAccounts(), loadMaintenanceStatus(), loadServerIp(), loadSupportMessages(), loadAuditLogs()]);
    }
    if (onRefreshUser) onRefreshUser();
    setRefreshing(false);
  };

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;
    socket.emit('join_support_room', { userId: currentUser.id, role: currentUser.role, room: 'support_admin_room' });

    socket.on('support_message', (rawMsg: any) => {
      const newMsg = normalizeAdminSupportMsg(rawMsg);
      const targetUid = newMsg.userId;
      if (!targetUid) return;

      // Update active thread messages if the socket message belongs to currently open conversation
      setSelectedSupportUserId((currentSelectedId) => {
        if (currentSelectedId === targetUid) {
          setActiveThreadMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => {
            threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
        return currentSelectedId;
      });

      // Update support conversations roster
      setSupportConversations((prev) => {
        const filtered = prev.filter(m => (m.userId || (m as any).user_id) !== targetUid);
        return [newMsg, ...filtered];
      });
    });

    socket.on('support_cleared', (data: { userId: string }) => {
      if (data && data.userId) {
        setSupportConversations((prev) => prev.filter(m => (m.userId || (m as any).user_id) !== data.userId));
        setSelectedSupportUserId((currentSelectedId) => {
          if (currentSelectedId === data.userId) {
            setActiveThreadMessages([]);
          }
          return currentSelectedId;
        });
      }
    });

    socket.on('financeUpdated', (data: any) => {
      if (data) setFinance(data);
    });

    socket.on('finance_updated', (data: any) => {
      if (data) setFinance(data);
    });

    socket.on('userUpdated', (updatedUser: any) => {
      if (updatedUser && updatedUser.id) {
        setUsersList((prev) => {
          const idx = prev.findIndex((u) => u.id === updatedUser.id);
          if (idx !== -1) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...updatedUser };
            return copy;
          } else {
            return [updatedUser, ...prev];
          }
        });
      }
    });

    socket.on('userBalanceUpdated', (data: { userId: string; balance?: number; escrowBalance?: number }) => {
      if (data && data.userId) {
        setUsersList((prev) =>
          prev.map((u) => {
            if (u.id === data.userId) {
              return {
                ...u,
                ...(data.balance !== undefined ? { balance: data.balance } : {}),
                ...(data.escrowBalance !== undefined ? { escrowBalance: data.escrowBalance, escrow_balance: data.escrowBalance } : {}),
              };
            }
            return u;
          })
        );
      }
    });

    socket.on('deposit_updated', () => {
      loadFinance();
      loadUsers();
    });

    socket.on('withdrawal_updated', () => {
      loadFinance();
      loadUsers();
    });

    socket.on('matchUpdated', () => {
      loadFinance();
      loadUsers();
    });

    socket.on('match_updated', () => {
      loadFinance();
      loadUsers();
    });

    const init = async () => {
      setLoading(true);
      if (currentUser.role === 'moderator') {
        await Promise.all([loadDisputes(), loadReviewQueue(), loadServerIp()]);
      } else if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
        await Promise.all([loadFinance(), loadUsers(), loadGmail(), loadDisputes(), loadReviewQueue(), loadFeeSettings(), loadFlaggedAccounts(), loadMaintenanceStatus(), loadServerIp(), loadSupportMessages(), loadAuditLogs()]);
      }
      setLoading(false);
    };
    init();

    return () => {
      socket.disconnect();
    };
  }, [currentUser.id, currentUser.role]);

  // Moderation Handlers
  const handleApprovePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModal.match || !payoutModal.selectedWinnerId) return;
    setPayoutModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await adminResolveMatch(payoutModal.match.id, currentUser.id, payoutModal.selectedWinnerId);
      setPayoutModal({ isOpen: false, match: null, selectedWinnerId: '', isSubmitting: false, error: null });
      await Promise.all([loadReviewQueue(), loadFinance(), loadDisputes()]);
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      setPayoutModal(prev => ({ ...prev, isSubmitting: false, error: err.message || 'Failed to approve payout' }));
    }
  };

  const handleResubmitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitModal.match) return;
    setResubmitModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await adminResubmitMatch({
        matchId: resubmitModal.match.id,
        adminUserId: currentUser.id,
        targetPlayerId: resubmitModal.targetPlayerId,
        reason: resubmitModal.reason,
      });
      setResubmitModal({ isOpen: false, match: null, targetPlayerId: 'both', reason: '', isSubmitting: false, error: null });
      await Promise.all([loadReviewQueue(), loadDisputes()]);
    } catch (err: any) {
      setResubmitModal(prev => ({ ...prev, isSubmitting: false, error: err.message || 'Failed to request resubmission' }));
    }
  };

  const handleEscalateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateModal.match) return;
    setEscalateModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await adminEscalateMatch({
        matchId: escalateModal.match.id,
        adminUserId: currentUser.id,
        reason: escalateModal.reason,
      });
      setEscalateModal({ isOpen: false, match: null, reason: '', isSubmitting: false, error: null });
      await Promise.all([loadReviewQueue(), loadDisputes()]);
    } catch (err: any) {
      setEscalateModal(prev => ({ ...prev, isSubmitting: false, error: err.message || 'Failed to escalate match' }));
    }
  };

  const handleClaimMatch = async (matchId: string) => {
    try {
      setRefreshing(true);
      await claimMatchReview(matchId, currentUser.id);
      await loadReviewQueue();
    } catch (err: any) {
      alert(err.message || 'Failed to claim match for review');
    } finally {
      setRefreshing(false);
    }
  };

  const filteredReviewQueue = reviewQueueMatches.filter(m => {
    const search = queueSearch.toLowerCase().trim();
    const matchesSearch = !search ||
      m.challengeCode.toLowerCase().includes(search) ||
      (m.roomCode && m.roomCode.toLowerCase().includes(search)) ||
      m.creator.codmIgn.toLowerCase().includes(search) ||
      (m.opponent && m.opponent.codmIgn.toLowerCase().includes(search));

    if (!matchesSearch) return false;

    if (queueFilter === 'disputed') {
      return m.status === 'DISPUTED';
    }
    if (queueFilter === 'ai_flagged') {
      return !!(m.creator?.systemAiDetection?.isLikelyFake || m.opponent?.systemAiDetection?.isLikelyFake);
    }
    if (queueFilter === 'resubmit') {
      return !!(m.resubmissionNotice || m.creator?.resubmissionRequested || m.opponent?.resubmissionRequested || m.resolutionNotes?.includes('Resubmission'));
    }
    return true;
  });

  // Actions
  const handleSyncGmail = async () => {
    setGmailSyncing(true);
    setGmailSyncMsg(null);
    try {
      const res = await triggerGmailSync(currentUser.id);
      setGmailSyncMsg({ type: 'success', text: res.message || 'Sync successful!' });
      await loadGmail();
    } catch (err: any) {
      setGmailSyncMsg({ type: 'error', text: err.message || 'Sync failed' });
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleTestGmail = async () => {
    setGmailSyncing(true);
    setGmailSyncMsg(null);
    try {
      const res = await testGmailApiConnection(currentUser.id);
      setGmailSyncMsg({ type: 'success', text: res.message || 'Connection test successful!' });
    } catch (err: any) {
      setGmailSyncMsg({ type: 'error', text: err.message || 'Test failed' });
    } finally {
      setGmailSyncing(false);
    }
  };

  const handleConnectGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gmailForm.address.trim() || !gmailForm.password.trim()) {
      setGmailForm(prev => ({ ...prev, error: 'Please enter both Gmail address and 16-character App Password' }));
      return;
    }

    setGmailForm(prev => ({ ...prev, isSubmitting: true, error: null, success: null }));
    try {
      const res = await saveGmailCredentials(
        currentUser.id,
        gmailForm.address.trim(),
        gmailForm.password.trim(),
        gmailForm.autoSync
      );
      setGmailForm(prev => ({
        ...prev,
        isSubmitting: false,
        success: res.message || 'Connected successfully!',
      }));
      await loadGmail();
      setTimeout(() => {
        setConnectModalOpen(false);
        setGmailForm({
          address: '',
          password: '',
          autoSync: true,
          isSubmitting: false,
          error: null,
          success: null,
        });
      }, 1200);
    } catch (err: any) {
      setGmailForm(prev => ({
        ...prev,
        isSubmitting: false,
        error: err.message || 'Connection failed. Check your App Password.',
      }));
    }
  };

  const handleDisconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect this Gmail account? Auto-sync will stop.')) return;
    try {
      await disconnectGmailAccount(currentUser.id);
      await loadGmail();
    } catch (err: any) {
      alert(err.message || 'Failed to disconnect');
    }
  };

  const handleDeleteEmailItem = async (emailId: string) => {
    if (!confirm('Delete this email from the admin portal?')) return;
    try {
      await deleteAdminEmail(currentUser.id, emailId);
      setEmailsList(prev => prev.filter(m => m.id !== emailId));
      if (emailViewerModal?.id === emailId) {
        setEmailViewerModal(null);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete email');
    }
  };

  const handleCleanupVerifiedEmails = async () => {
    setCleaningVerifiedMails(true);
    try {
      const res = await cleanupVerifiedAdminMails(currentUser.id);
      alert(res.message || `Cleaned up verified mails.`);
      const fresh = await fetchAdminMailbox(currentUser.id);
      setEmailsList(fresh);
    } catch (err: any) {
      alert(err.message || 'Failed to clean up');
    } finally {
      setCleaningVerifiedMails(false);
    }
  };

  const handleToggleReadStatus = async (email: AdminEmailItem) => {
    try {
      const nextRead = !email.isRead;
      await markAdminEmailRead(currentUser.id, email.id, nextRead);
      setEmailsList(prev => prev.map(m => m.id === email.id ? { ...m, isRead: nextRead } : m));
      if (emailViewerModal?.id === email.id) {
        setEmailViewerModal(prev => prev ? { ...prev, isRead: nextRead } : null);
      }
    } catch (err: any) {
      console.error('Error toggling email read status:', err);
    }
  };

  const handleExecuteFeeWithdrawal = async () => {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0) return setWithdrawErrorMsg('Please enter a valid amount');
    
    setIsWithdrawing(true);
    setWithdrawSuccessMsg(null);
    setWithdrawErrorMsg(null);

    try {
      await withdrawPlatformFees(currentUser.id, amount);
      setWithdrawSuccessMsg(`₦${amount.toLocaleString()} withdrawn to your wallet!`);
      setWithdrawAmount('');
      await loadFinance();
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      setWithdrawErrorMsg(err.message || 'Failed to withdraw');
    } finally {
      setIsWithdrawing(false);
    }
  };

  const handleAssignRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignIdentifier.trim()) return;

    setIsAssigning(true);
    setAssignMsg(null);
    try {
      const res = await assignUserRole(currentUser.id, {
        identifier: assignIdentifier.trim(),
        role: assignRoleType,
      });
      setAssignMsg({ type: 'success', text: res.message });
      setAssignIdentifier('');
      loadUsers();
    } catch (err: any) {
      setAssignMsg({ type: 'error', text: err.message || 'Failed to assign role' });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAdjustBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModal.user) return;
    const numAmount = parseFloat(balanceModal.amount);
    if (!numAmount || numAmount <= 0) return;

    setBalanceModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const res = await adjustUserBalance(
        currentUser.id,
        balanceModal.user.id,
        numAmount,
        balanceModal.type,
        balanceModal.reason.trim() || `Admin manual ${balanceModal.type}`
      );
      setBalanceModal({
        isOpen: false,
        user: null,
        amount: '',
        type: 'credit',
        reason: '',
        isSubmitting: false,
        error: null,
      });
      loadUsers();
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      setBalanceModal(prev => ({ ...prev, isSubmitting: false, error: err.message || 'Failed' }));
    }
  };

  if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'moderator') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-neutral-900 border border-neutral-800 rounded-[2rem] text-white space-y-8 max-w-2xl mx-auto shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <ShieldCheck size={48} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Sector Restricted</h2>
          <p className="text-neutral-500 max-w-xs mx-auto leading-relaxed text-xs">Access restricted to verified staff members. Security credentials required to initialize session.</p>
        </div>
        <form onSubmit={async (e) => { e.preventDefault(); try { await claimAdminRole(currentUser.id, adminPasscode.trim()); window.location.reload(); } catch(err:any) { setClaimMsg(err.message); } }} className="w-full space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4">Authorization Key</label>
            <input
              type="password"
              name="auth_key"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={adminPasscode}
              onChange={e => setAdminPasscode(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-center font-mono tracking-[1em] focus:border-amber-400 focus:outline-none transition-all placeholder:tracking-normal placeholder:font-sans"
            />
          </div>
          {claimMsg && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest text-center rounded-xl">{claimMsg}</div>}
          <button type="submit" className="w-full bg-amber-400 text-black font-black py-5 rounded-2xl uppercase tracking-[0.2em] hover:bg-amber-300 transition-all active:scale-[0.98] shadow-lg shadow-amber-400/20">Authenticate Session</button>
        </form>
      </div>
    );
  }

  const availableFees = finance?.available_fees ?? 0;
  const filteredUsers = usersList.filter(u => {
    const q = usersSearch.toLowerCase();
    const matchesSearch = (u.codmIgn?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q));
    const matchesFilter = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-8 min-h-screen pb-20">
      {/* SIDEBAR NAVIGATION */}
      <aside className="w-full lg:w-72 flex flex-col gap-4">
        <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] space-y-8 shadow-2xl sticky top-24">
          <div className="flex items-center gap-4 border-b border-neutral-800/50 pb-8">
            <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center text-black font-black text-2xl shadow-xl shadow-amber-400/20">
              {currentUser.role === 'moderator' ? 'M' : 'A'}
            </div>
            <div>
              <h1 className="font-black text-white uppercase tracking-tighter text-2xl leading-none">HQ COMMAND</h1>
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">
                {currentUser.role === 'moderator' ? 'Moderator Sector' : 'Admin Sector'}
              </p>
            </div>
          </div>

          <nav className="flex flex-col gap-3">
            {[
              { id: 'review_queue', icon: AlertTriangle, label: 'Review Queue', badge: reviewQueueMatches.length, roles: ['admin', 'moderator', 'super_admin'] },
              { id: 'finance', icon: Wallet, label: 'Treasury', badge: `₦${availableFees.toLocaleString()}`, roles: ['admin', 'super_admin'] },
              { id: 'users', icon: Users, label: 'Gladiators', badge: usersList.length, roles: ['admin', 'super_admin'] },
              { id: 'disputes', icon: ShieldCheck, label: 'Disputes', badge: disputesList.length, roles: ['admin', 'moderator', 'super_admin'] },
              { id: 'support', icon: Headphones, label: 'Support Inbox', badge: supportConversations.length, roles: ['admin', 'moderator', 'super_admin'] },
              { id: 'broadcast', icon: Megaphone, label: 'Global Broadcast', badge: currentActiveBroadcast ? 'LIVE' : 'OFF', roles: ['admin', 'moderator', 'super_admin'] },
              { id: 'gmail', icon: Mail, label: 'Sync Engine', badge: emailsList.length, roles: ['admin', 'super_admin'] },
              { id: 'multi_accounts', icon: ShieldAlert, label: 'Multi-Accounts', badge: flaggedAccounts.length, roles: ['admin', 'super_admin'] },
              { id: 'audit_logs', icon: ClipboardList, label: 'Audit Logs', badge: auditLogs.length, roles: ['admin', 'super_admin'] },
              { id: 'maintenance', icon: Settings, label: 'Maintenance & IP', badge: maintenanceEnabled ? 'ACTIVE' : 'OFF', roles: ['admin', 'super_admin'] }
            ].filter(tab => tab.roles.includes(currentUser.role || 'user')).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-between p-4.5 rounded-[1.25rem] transition-all duration-300 group relative overflow-hidden ${activeTab === tab.id ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/10' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}
              >
                <div className="flex items-center gap-3.5 relative z-10">
                  <tab.icon size={20} className={activeTab === tab.id ? 'text-black' : 'text-neutral-500 group-hover:text-amber-400 transition-colors'} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg relative z-10 ${activeTab === tab.id ? 'bg-black/10' : tab.id === 'maintenance' && maintenanceEnabled ? 'bg-amber-500/20 text-amber-400 font-black' : 'bg-neutral-800/50 text-neutral-500'}`}>{tab.badge}</span>
                {activeTab === tab.id && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />}
              </button>
            ))}
          </nav>

          <div className="pt-8 border-t border-neutral-800/50 space-y-5">
            <button onClick={reloadAll} className="w-full flex items-center justify-center gap-2.5 py-4 border border-neutral-800 rounded-2xl text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:bg-neutral-800 hover:text-white hover:border-neutral-700 transition-all active:scale-95 group">
              <RefreshCw size={14} className={`${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              Sync Systems
            </button>
            <div className="p-5 bg-black/40 rounded-[1.5rem] border border-neutral-800/30 space-y-3">
              <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.3em] text-center mb-1">Infrastructure</p>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-neutral-500 uppercase tracking-tighter">Core DB</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE</span>
              </div>
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className="text-neutral-500 uppercase tracking-tighter">Realtime</span>
                <span className="text-emerald-500 font-bold flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> STABLE</span>
              </div>
              <div className="pt-2 border-t border-neutral-800/40 flex justify-between items-center text-[10px] font-mono">
                <span className="text-neutral-500 uppercase tracking-tighter">Server IP</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(serverIp);
                    setCopiedIp(true);
                    setTimeout(() => setCopiedIp(false), 2000);
                  }}
                  className="text-cyan-400 font-bold flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
                  title="Click to copy server outbound IP"
                >
                  <span>{serverIp}</span>
                  {copiedIp ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
        
        {/* TOP LIVE GLOBAL MARQUEE BROADCAST CONTROL BAR */}
        <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-black border border-cyan-500/40 p-6 md:p-8 rounded-[2.5rem] shadow-2xl space-y-5 relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Megaphone size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Site-Wide Live Marquee Broadcast</h3>
                  {currentActiveBroadcast ? (
                    <span className="px-3 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      LIVE NOW
                    </span>
                  ) : (
                    <span className="px-3 py-0.5 rounded-full bg-neutral-800 text-neutral-500 text-[9px] font-black uppercase tracking-widest">
                      IDLE
                    </span>
                  )}
                </div>
                <p className="text-xs text-neutral-400 font-medium">Broadcast live announcements across the top of all player screens in real-time.</p>
              </div>
            </div>

            {currentActiveBroadcast && (
              <button
                onClick={() => handleClearBroadcast()}
                disabled={isPublishingBroadcast}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/20 shrink-0"
              >
                Clear Broadcast
              </button>
            )}
          </div>

          {activeBroadcasts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-800/80">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 block">
                Active Live Announcements ({activeBroadcasts.length})
              </span>
              <div className="flex flex-col gap-2">
                {activeBroadcasts.map((bcast) => (
                  <div key={bcast.id} className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 font-mono text-xs text-cyan-200 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 shrink-0">
                        {bcast.type}
                      </span>
                      <span className="truncate font-bold text-white">{bcast.message}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClearBroadcast(bcast.id)}
                      className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase underline shrink-0 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handlePublishBroadcast} className="flex flex-col md:flex-row gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={broadcastType}
                onChange={e => setBroadcastType(e.target.value as any)}
                className="bg-black border border-neutral-800 rounded-xl px-3 py-3 text-xs font-mono text-cyan-400 font-bold focus:outline-none focus:border-cyan-400"
              >
                <option value="warning">⚠️ Warning (Amber)</option>
                <option value="urgent">🚨 Urgent (Rose)</option>
                <option value="info">📢 Announcement (Cyan)</option>
                <option value="success">🎉 Event (Emerald)</option>
              </select>
            </div>
            <input
              type="text"
              value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              placeholder="Enter site-wide broadcast message (e.g. 🚨 Maintenance in 15 mins! Please finish active matches.)"
              className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-400 transition-all"
            />
            <button
              type="submit"
              disabled={isPublishingBroadcast || !broadcastText.trim()}
              className="px-6 py-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-cyan-400/20"
            >
              {isPublishingBroadcast ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              <span>Publish Live</span>
            </button>
          </form>

          {broadcastStatusMsg && (
            <div className={`p-3 rounded-xl border text-[11px] font-black uppercase tracking-wider text-center ${broadcastStatusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
              {broadcastStatusMsg.text}
            </div>
          )}
        </div>
        
        {/* Telegram Group Banner for Screen Records & Disputes */}
        <div className="bg-gradient-to-r from-cyan-950/80 via-neutral-900 to-cyan-950/80 border border-cyan-500/30 p-6 rounded-[2rem] shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Send size={24} />
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Admin & Moderator Telegram Group</h3>
              <p className="text-xs text-neutral-300 pt-0.5">
                Join the official Telegram group for instant screen record reviews, room code conflict checks, and dispute coordination.
              </p>
            </div>
          </div>
          <a
            href="https://t.me/+I5vcFF4RXwJkMWVk"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shrink-0 shadow-lg shadow-cyan-500/20"
          >
            <span>Join Telegram Group</span>
            <ExternalLink size={16} />
          </a>
        </div>

        {/* HEADER SUMMARY CARDS */}
        {currentUser.role === 'moderator' ? (
          <header className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 duration-700"><AlertTriangle size={160} /></div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-1">Moderation Queue</p>
              <h2 className="text-4xl font-black text-amber-400 font-mono tracking-tighter">{reviewQueueMatches.length}</h2>
              <div className="flex items-center gap-2 mt-4">
                <div className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>Pending Audits</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">1-Admin Lock</span>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 duration-700"><ShieldCheck size={160} /></div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-1">Active Disputes</p>
              <h2 className="text-4xl font-black text-white font-mono tracking-tighter">{disputesList.length}</h2>
              <div className="flex items-center gap-2 mt-4">
                <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Shield size={12} />
                  <span>Forensic Proofs</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">Screen Records</span>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 duration-700"><Send size={160} /></div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-1">Telegram Review</p>
              <h2 className="text-4xl font-black font-mono tracking-tighter text-cyan-400">ACTIVE</h2>
              <div className="flex items-center gap-2 mt-4">
                <div className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                  <CheckCircle2 size={12} />
                  <span>Evidence Channel</span>
                </div>
              </div>
            </div>
          </header>
        ) : (
          <header className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 duration-700"><Wallet size={160} /></div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-1">Fee Treasury</p>
              <h2 className="text-4xl font-black text-emerald-400 font-mono tracking-tighter">₦{availableFees.toLocaleString()}</h2>
              <div className="flex items-center gap-2 mt-4">
                <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <TrendingUp size={12} />
                  <span>+10% Rake</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">Automated</span>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 duration-700"><Users size={160} /></div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-1">Active Population</p>
              <h2 className="text-4xl font-black text-white font-mono tracking-tighter">{usersList.length}</h2>
              <div className="flex items-center gap-2 mt-4">
                <div className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-black uppercase tracking-widest flex items-center gap-1.5">
                  <Shield size={12} />
                  <span>{usersList.filter(u => u.role === 'admin').length} Authorized</span>
                </div>
                <span className="text-[10px] text-neutral-500 font-bold">Total Gladiators</span>
              </div>
            </div>

            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="absolute -top-4 -right-4 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-all group-hover:scale-110 duration-700"><Mail size={160} /></div>
              <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-1">Engine Status</p>
              <h2 className={`text-4xl font-black font-mono tracking-tighter ${gmailStatus?.configured ? 'text-amber-400' : 'text-neutral-600'}`}>{gmailStatus?.configured ? 'ACTIVE' : 'OFFLINE'}</h2>
              <div className="flex items-center gap-2 mt-4">
                <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${gmailStatus?.configured ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'}`}>
                  {gmailStatus?.configured ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  <span>{gmailStatus?.configured ? 'IMAP SSL Stable' : 'Action Req.'}</span>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* TAB CONTENT: MULTI-ACCOUNT DETECTION */}
        {activeTab === 'multi_accounts' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
                    <ShieldAlert size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Multi-Account Detection Hub</h2>
                    <p className="text-xs text-neutral-400 font-medium">Scanning users sharing duplicate Email, Phone Number, CODM IGN, or Bank Account numbers.</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={loadFlaggedAccounts}
                disabled={flaggedLoading}
                className="px-6 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl border border-neutral-700 flex items-center gap-2 transition-all active:scale-95"
              >
                <RefreshCw size={14} className={flaggedLoading ? 'animate-spin' : ''} />
                Refresh Scan
              </button>
            </div>

            {/* Clusters / Flagged Accounts List */}
            {flaggedAccounts.length === 0 ? (
              <div className="bg-neutral-900 border border-neutral-800 p-16 rounded-[2.5rem] text-center space-y-4 shadow-2xl">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
                  <ShieldCheck size={40} />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Zero Multi-Accounting Violations</h3>
                <p className="text-xs text-neutral-500 max-w-md mx-auto">All registered users have unique emails, phone numbers, CODM usernames, and bank account numbers.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {flaggedAccounts.map(account => (
                  <div key={account.id} className="bg-neutral-900 border border-rose-500/30 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group hover:border-rose-500/60 transition-all space-y-6">
                    <div className="absolute top-0 right-0 bg-rose-500/10 text-rose-400 text-[10px] font-black uppercase tracking-widest px-6 py-2 rounded-bl-2xl border-l border-b border-rose-500/20">
                      ⚠️ Flagged Duplicate
                    </div>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 border border-rose-500/30 flex items-center justify-center text-white font-black text-xl">
                          {account.codmIgn?.slice(0, 2).toUpperCase() || 'MA'}
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-white">{account.codmIgn}</h3>
                          <p className="text-xs text-neutral-400 font-mono">ID: {account.id} • Registered: {new Date(account.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest block">Wallet Balance</span>
                        <span className="text-xl font-mono font-black text-amber-400">₦{account.balance.toLocaleString()}</span>
                      </div>
                    </div>

                    <div className="p-5 bg-black/50 rounded-2xl border border-neutral-800 grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-neutral-500 font-sans uppercase block">Email Address</span>
                        <span className="text-white font-bold">{account.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 font-sans uppercase block">Phone Number</span>
                        <span className="text-white font-bold">{account.phone || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-neutral-500 font-sans uppercase block">Bank & Account</span>
                        <span className="text-white font-bold">{account.bankName || 'Bank'} : {account.accountNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 font-sans uppercase block font-black">Flag Reason</span>
                        <span className="text-rose-300 font-bold">{account.flagReason || 'Shared attribute match'}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-4 pt-2 border-t border-neutral-800/50">
                      <button
                        onClick={async () => {
                          try {
                            await dismissAccountFlag(currentUser.id, account.id);
                            loadFlaggedAccounts();
                          } catch (e: any) {
                            alert(e.message || 'Failed to dismiss flag');
                          }
                        }}
                        className="px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-black text-xs uppercase tracking-widest transition-all"
                      >
                        Dismiss Flag
                      </button>
                      {(account as any).role === 'banned' ? (
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to unban account ${account.codmIgn}?`)) {
                              try {
                                await unbanAccount(currentUser.id, account.id);
                                loadFlaggedAccounts();
                              } catch (e: any) {
                                alert(e.message || 'Failed to unban account');
                              }
                            }
                          }}
                          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/30 transition-all"
                        >
                          Unban Account
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to ban duplicate account ${account.codmIgn}?`)) {
                              try {
                                await banDuplicateAccount(currentUser.id, account.id);
                                loadFlaggedAccounts();
                              } catch (e: any) {
                                alert(e.message || 'Failed to ban account');
                              }
                            }
                          }}
                          className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/30 transition-all"
                        >
                          Ban Account
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: AUDIT LOGS */}
        {activeTab === 'audit_logs' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-400/10 border border-purple-400/30 flex items-center justify-center text-purple-400">
                    <ClipboardList size={22} />
                  </div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Staff Security Audit Logs</h3>
                </div>
                <p className="text-neutral-400 text-xs font-medium">
                  Complete immutable audit trail tracking all sensitive admin operations (balance edits, bans, dispute resolutions, role grants, and broadcast announcements).
                </p>
              </div>
              <button
                onClick={loadAuditLogs}
                disabled={auditLoading}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg"
              >
                <RefreshCw size={14} className={auditLoading ? 'animate-spin' : ''} />
                <span>Refresh Logs</span>
              </button>
            </header>

            {/* AUDIT LOG CONTROLS: SEARCH & CATEGORY FILTER */}
            <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-[2rem] shadow-2xl flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={e => {
                    setAuditSearch(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') loadAuditLogs();
                  }}
                  placeholder="Search audit logs by Admin IGN, Target Gladiator, Action, or Details..."
                  className="w-full bg-black border border-neutral-800 rounded-xl pl-11 pr-4 py-3 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-purple-400 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
                {[
                  { id: 'ALL', label: 'All Actions' },
                  { id: 'BALANCE', label: '💰 Balance' },
                  { id: 'BAN', label: '🚨 Bans' },
                  { id: 'DISPUTE', label: '🛡️ Disputes' },
                  { id: 'BROADCAST', label: '📢 Broadcasts' },
                  { id: 'ROLE', label: '🔑 Roles' },
                  { id: 'MAINTENANCE', label: '⚙️ System' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setAuditCategory(cat.id);
                    }}
                    className={`px-3.5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${auditCategory === cat.id ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/20' : 'bg-black border border-neutral-800 text-neutral-400 hover:text-white'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AUDIT LOGS TABLE / LIST */}
            {auditLoading ? (
              <div className="p-16 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] text-center space-y-4 shadow-2xl">
                <Loader2 size={36} className="animate-spin text-purple-400 mx-auto" />
                <p className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest">Retrieving Audit Logs...</p>
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="p-16 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] text-center space-y-4 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500 mx-auto">
                  <ClipboardList size={32} />
                </div>
                <h4 className="text-xl font-black text-white uppercase tracking-tight">No Audit Logs Found</h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">No sensitive admin actions match your current search or category filter criteria.</p>
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Showing {auditLogs.length} Logged Actions
                  </span>
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                    Timezone: Local System
                  </span>
                </div>

                <div className="divide-y divide-neutral-800/60">
                  {auditLogs.map(log => {
                    const getCatBadge = (cat: string) => {
                      switch (cat) {
                        case 'BALANCE':
                          return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
                        case 'BAN':
                          return 'bg-rose-500/10 border-rose-500/30 text-rose-400';
                        case 'DISPUTE':
                          return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
                        case 'BROADCAST':
                          return 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400';
                        case 'ROLE':
                          return 'bg-purple-500/10 border-purple-500/30 text-purple-400';
                        case 'MAINTENANCE':
                          return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
                        default:
                          return 'bg-neutral-800 border-neutral-700 text-neutral-400';
                      }
                    };

                    return (
                      <div key={log.id} className="p-6 hover:bg-black/30 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-widest ${getCatBadge(log.category)}`}>
                              {log.category}
                            </span>
                            <span className="text-sm font-black text-white tracking-wide">{log.action}</span>
                            {log.targetUserName && (
                              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md">
                                Target: {log.targetUserName}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-neutral-300 leading-relaxed max-w-3xl">{log.details}</p>
                        </div>

                        <div className="flex flex-col items-end shrink-0 text-right space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Admin:</span>
                            <span className="text-xs font-black text-amber-400 font-mono">{log.adminName}</span>
                          </div>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {new Date(log.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date(log.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: GLOBAL MARQUEE BROADCAST */}
        {activeTab === 'broadcast' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400">
                    <Megaphone size={22} />
                  </div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Global Marquee Broadcast</h3>
                </div>
                <p className="text-neutral-400 text-xs font-medium">
                  Publish real-time announcements, maintenance notices, and promotional event tickers to all connected players across the app.
                </p>
              </div>
              <button
                onClick={loadActiveBroadcast}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg"
              >
                <RefreshCw size={14} />
                <span>Refresh Broadcast</span>
              </button>
            </header>

            {/* GLOBAL BROADCAST MARQUEE CONTROLLER */}
            <section className="bg-neutral-900 border border-neutral-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800/80 pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Megaphone size={24} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">Live Marquee Broadcast Manager</h4>
                    <p className="text-xs text-neutral-400 font-medium">Broadcasts instantly appear on top of all active player screens via WebSockets (0ms latency).</p>
                  </div>
                </div>
                {activeBroadcasts.length > 0 ? (
                  <span className="px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    {activeBroadcasts.length} BROADCASTS LIVE NOW
                  </span>
                ) : (
                  <span className="px-3.5 py-1.5 rounded-full bg-neutral-800 text-neutral-500 text-[10px] font-black uppercase tracking-widest">
                    IDLE
                  </span>
                )}
              </div>

              {/* Active Broadcasts List */}
              {activeBroadcasts.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-cyan-400 uppercase tracking-widest">
                      Active Live Announcements ({activeBroadcasts.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleClearBroadcast()}
                      disabled={isPublishingBroadcast}
                      className="text-xs text-rose-400 hover:text-rose-300 font-bold uppercase underline cursor-pointer"
                    >
                      Clear All Broadcasts
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {activeBroadcasts.map((bcast) => (
                      <div key={bcast.id} className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-black uppercase tracking-wider">
                              {bcast.type}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-mono">ID: {bcast.id}</span>
                          </div>
                          <p className="text-sm font-bold text-white font-mono">{bcast.message}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleClearBroadcast(bcast.id)}
                          disabled={isPublishingBroadcast}
                          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/20 shrink-0 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-black/40 border border-neutral-800/60 text-xs text-neutral-500 font-mono flex items-center gap-3">
                  <Sparkles size={16} className="text-amber-400 shrink-0" />
                  <span>No active broadcast marquee currently running. Enter a message below to broadcast live to all players.</span>
                </div>
              )}

              {/* Broadcast Composer Form */}
              <form onSubmit={handlePublishBroadcast} className="space-y-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Select Banner Style & Icon</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { id: 'warning', label: '⚠️ Warning', desc: 'Amber Alert Bar', color: 'border-amber-500/50 bg-amber-500/10 text-amber-300' },
                      { id: 'urgent', label: '🚨 Urgent', desc: 'Rose Emergency Bar', color: 'border-rose-500/50 bg-rose-500/10 text-rose-300' },
                      { id: 'info', label: '📢 Announcement', desc: 'Cyan Notice Bar', color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' },
                      { id: 'success', label: '🎉 Special Event', desc: 'Emerald Promo Bar', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' },
                    ].map(typeItem => (
                      <button
                        key={typeItem.id}
                        type="button"
                        onClick={() => setBroadcastType(typeItem.id as any)}
                        className={`p-4 rounded-2xl border text-left transition-all ${broadcastType === typeItem.id ? `${typeItem.color} ring-2 ring-white/20 shadow-xl scale-[1.02]` : 'border-neutral-800 bg-neutral-900/60 text-neutral-500 hover:text-neutral-300'}`}
                      >
                        <span className="block text-xs font-black uppercase tracking-wider">{typeItem.label}</span>
                        <span className="block text-[10px] opacity-70 font-mono mt-0.5">{typeItem.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Marquee Message Content</label>
                  <textarea
                    rows={3}
                    value={broadcastText}
                    onChange={e => setBroadcastText(e.target.value)}
                    placeholder="e.g. 🚨 Scheduled maintenance in 15 minutes! Please complete active matches and refrain from placing new wagers."
                    className="w-full bg-black border border-neutral-800 rounded-2xl p-5 text-sm font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-400 transition-all shadow-inner"
                  />
                </div>

                {broadcastStatusMsg && (
                  <div className={`p-4 rounded-xl border text-xs font-black uppercase tracking-wider text-center ${broadcastStatusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    {broadcastStatusMsg.text}
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={isPublishingBroadcast || !broadcastText.trim()}
                    className="w-full md:w-auto px-10 py-5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-cyan-400/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isPublishingBroadcast ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    <span>Publish Live Broadcast</span>
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {/* TAB CONTENT: REVIEW QUEUE */}
        {activeTab === 'review_queue' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header with Title & Live Counters */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Review Queue</h3>
                  <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg">
                    {reviewQueueMatches.length} Pending
                  </span>
                </div>
                <p className="text-neutral-400 text-xs font-medium">
                  Deterministic heuristic analysis (Magic byte headers, 16:9/20:9 mobile display ratios, AI generator metadata). No automated AI review.
                </p>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={loadReviewQueue}
                  disabled={queueLoading}
                  className="px-5 py-3 rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={queueLoading ? 'animate-spin' : ''} />
                  <span>Refresh Queue</span>
                </button>
              </div>
            </header>

            {/* Interactive Search & Filter Controls */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 p-2 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  type="text"
                  value={queueSearch}
                  onChange={e => setQueueSearch(e.target.value)}
                  placeholder="Search by challenge code, room code, or gladiator IGN..."
                  className="w-full bg-black/60 border border-neutral-800/80 rounded-xl pl-11 pr-4 py-2.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-amber-400/60 font-medium"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-black/40 rounded-xl border border-neutral-800/60">
                {[
                  { id: 'all', label: 'All Pending', count: reviewQueueMatches.length },
                  { id: 'disputed', label: 'Disputes', count: reviewQueueMatches.filter(m => m.status === 'DISPUTED').length },
                  { id: 'ai_flagged', label: 'AI Flags', count: reviewQueueMatches.filter(m => m.creator?.systemAiDetection?.isLikelyFake || m.opponent?.systemAiDetection?.isLikelyFake).length },
                  { id: 'resubmit', label: 'Resubmissions', count: reviewQueueMatches.filter(m => m.resubmissionNotice || m.creator?.resubmissionRequested || m.opponent?.resubmissionRequested).length }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setQueueFilter(f.id as any)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                      queueFilter === f.id
                        ? 'bg-amber-400 text-neutral-950 shadow-sm'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${queueFilter === f.id ? 'bg-black/20 text-neutral-950 font-black' : 'bg-neutral-800 text-neutral-400'}`}>
                      {f.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grid Layout of Pending Matches */}
            {filteredReviewQueue.length > 0 ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {filteredReviewQueue.map(match => {
                  const creatorAi = match.creator?.systemAiDetection;
                  const opponentAi = match.opponent?.systemAiDetection;
                  const hasAiFlags = !!(creatorAi?.isLikelyFake || opponentAi?.isLikelyFake);
                  const isDisputed = match.status === 'DISPUTED';

                  return (
                    <div
                      key={match.id}
                      className={`p-7 rounded-[2rem] bg-neutral-900 border transition-all duration-300 shadow-xl space-y-6 relative overflow-hidden ${
                        isDisputed
                          ? 'border-rose-500/40 bg-gradient-to-b from-rose-950/10 to-neutral-900'
                          : hasAiFlags
                          ? 'border-amber-500/40 bg-gradient-to-b from-amber-950/10 to-neutral-900'
                          : 'border-neutral-800'
                      }`}
                    >
                      {/* Match Card Header */}
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-neutral-800/70 pb-4">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h4 className="text-lg font-black text-white font-mono uppercase tracking-tight">
                              #{match.challengeCode}
                            </h4>
                            {match.roomCode && (
                              <span className="text-[10px] font-mono text-neutral-400 bg-black/60 px-2 py-0.5 rounded border border-neutral-800">
                                Room #{match.roomCode}
                              </span>
                            )}
                            <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${
                              isDisputed
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              {match.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-1">
                            <span>{match.gameMode}</span>
                            <span className="mx-1.5 text-neutral-600">·</span>
                            <span>{match.map}</span>
                            <span className="mx-1.5 text-neutral-600">·</span>
                            <span className="font-mono text-neutral-500">{new Date(match.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end gap-2">
                          <div className="flex flex-col items-end">
                            <div className="text-base font-black text-emerald-400 font-mono">
                              ₦{match.potAmount.toLocaleString()} POT
                            </div>
                            <div className="text-[10px] text-neutral-500 font-mono">
                              ₦{match.stakeAmount.toLocaleString()} stake · ₦{match.winnerPayout.toLocaleString()} payout
                            </div>
                          </div>

                          {/* Reviewer Assignment Badge */}
                          {match.reviewerId ? (
                            <div className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 ${
                              match.reviewerId === currentUser.id 
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                : 'bg-neutral-800 border-neutral-700 text-neutral-500'
                            }`}>
                              {match.reviewerId === currentUser.id ? (
                                <><UserCheck size={12} /> Reviewing (You)</>
                              ) : (
                                <><Shield size={12} /> Claimed by {match.reviewerName || 'Staff'}</>
                              )}
                            </div>
                          ) : (
                            <div className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">
                              Unclaimed
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Conflict Explanation Banner */}
                      {(match.conflictReason || match.resolutionNotes || isDisputed || hasAiFlags) && (
                        <div className={`p-4 rounded-xl border text-xs space-y-1.5 ${
                          isDisputed
                            ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                            : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
                        }`}>
                          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                            <AlertTriangle size={14} className={isDisputed ? 'text-rose-400' : 'text-amber-400'} />
                            <span>Conflict Explanation & System Notice</span>
                          </div>
                          <p className="text-neutral-200 text-xs leading-relaxed font-medium">
                            {match.conflictReason || match.resolutionNotes || 'Conflicting outcome claims submitted. Reviewing screenshot evidence.'}
                          </p>
                          {match.resubmissionNotice && (
                            <p className="text-[11px] text-amber-400 font-semibold pt-1 border-t border-amber-500/20">
                              Resubmission Notice ({match.resubmissionNotice.targetPlayerIgn}): "{match.resubmissionNotice.reason}"
                            </p>
                          )}
                        </div>
                      )}

                      {/* Telegram Admin Group Evidence Verification Box */}
                      <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-3">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
                          <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                            <Send size={15} className="text-cyan-400 shrink-0" />
                            <span>Telegram Admin Group Evidence Verification</span>
                          </div>
                          <a
                            href="https://t.me/+I5vcFF4RXwJkMWVk"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-all cursor-pointer"
                          >
                            <span>Open Telegram Admin Group</span>
                            <ExternalLink size={12} />
                          </a>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                          <div className="p-2.5 bg-black/60 rounded-xl border border-neutral-800">
                            <span className="text-[10px] text-neutral-500 block font-sans font-bold uppercase">Host Username</span>
                            <span className="text-white font-bold">{match.creator.codmIgn}</span>
                          </div>
                          <div className="p-2.5 bg-black/60 rounded-xl border border-neutral-800">
                            <span className="text-[10px] text-neutral-500 block font-sans font-bold uppercase">Rival Username</span>
                            <span className="text-white font-bold">{match.opponent?.codmIgn || 'Awaiting Opponent'}</span>
                          </div>
                          <div className="p-2.5 bg-black/60 rounded-xl border border-neutral-800">
                            <span className="text-[10px] text-neutral-500 block font-sans font-bold uppercase">Room Code</span>
                            <span className="text-amber-400 font-bold">{match.roomCode || match.challengeCode}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCopyTag(`#DISPUTE_${match.roomCode || match.challengeCode}`, `tag_${match.id}`)}
                            className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            {copiedTag === `tag_${match.id}` ? (
                              <><Check size={13} className="text-emerald-400 stroke-[3]" /> Copied Search Tag!</>
                            ) : (
                              <><Copy size={13} /> Copy Search Tag (#DISPUTE_{match.roomCode || match.challengeCode})</>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyTag(match.roomCode || match.challengeCode, `code_${match.id}`)}
                            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                          >
                            {copiedTag === `code_${match.id}` ? (
                              <><Check size={13} className="text-emerald-400 stroke-[3]" /> Copied Room Code!</>
                            ) : (
                              <><Copy size={13} /> Copy Room Code ({match.roomCode || match.challengeCode})</>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Dual Player Breakdown (Host vs Rival) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Host Side */}
                        <div className="p-4 rounded-2xl bg-black/40 border border-neutral-800 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(match.creator.codmIgn)}`} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 object-cover shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">{match.creator.codmIgn}</div>
                                <div className="text-[9px] text-neutral-500 font-mono">HOST · UID: {match.creator.codmUid.slice(-6)}</div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                              match.creator.resultClaim === 'VICTORY'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : match.creator.resultClaim === 'DEFEAT'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : match.creator.resultClaim === 'DRAW'
                                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                                : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                            }`}>
                              {match.creator.resultClaim ? `CLAIM: ${match.creator.resultClaim}` : 'NO CLAIM'}
                            </span>
                          </div>

                          {/* Host Screenshot */}
                          <div className="space-y-2">
                            {match.creator.screenshotUrl ? (
                              <div
                                onClick={() => setLightboxData({
                                  url: match.creator.screenshotUrl!,
                                  playerIgn: match.creator.codmIgn,
                                  role: 'HOST',
                                  matchCode: match.challengeCode,
                                  systemAi: creatorAi
                                })}
                                className="relative aspect-video bg-black rounded-xl overflow-hidden border border-neutral-800 group/img cursor-pointer hover:border-amber-400/50 transition-all"
                              >
                                {match.creator.screenshotUrl.startsWith('data:video/') ? (
                                  <video src={match.creator.screenshotUrl} className="w-full h-full object-contain" />
                                ) : (
                                  <img src={match.creator.screenshotUrl} alt="Host proof" className="w-full h-full object-contain" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                                  <ZoomIn size={16} />
                                  <span>Inspect Full-Res</span>
                                </div>
                                <span className="absolute top-2 left-2 text-[9px] font-mono font-bold bg-black/70 px-2 py-0.5 rounded border border-white/10 text-neutral-300">
                                  HOST PROOF
                                </span>
                              </div>
                            ) : (
                              <div className="aspect-video bg-neutral-950 rounded-xl border border-dashed border-neutral-800 flex flex-col items-center justify-center text-neutral-600 gap-1.5 text-xs">
                                <Camera size={20} className="opacity-40" />
                                <span className="text-[10px] font-mono uppercase">
                                  {match.creator.resubmissionRequested ? 'Resubmission Awaited' : 'No Proof Uploaded'}
                                </span>
                              </div>
                            )}

                            {/* Host System Forensic Heuristics */}
                            {creatorAi ? (
                              <div className={`p-3 rounded-xl border text-[10px] space-y-2 ${
                                creatorAi.isLikelyFake
                                  ? 'bg-rose-950/20 border-rose-500/30'
                                  : 'bg-neutral-900/80 border-neutral-800'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">System Forensic Check</span>
                                  <span className={`font-mono font-bold ${
                                    creatorAi.isLikelyFake ? 'text-rose-400' : 'text-emerald-400'
                                  }`}>
                                    {creatorAi.verdict} ({Math.round(creatorAi.confidenceScore * 100)}%)
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-neutral-400 font-mono text-[9px]">
                                  <div>
                                    <span className="text-neutral-500 block">Ratio / Size:</span>
                                    <span className="text-neutral-200">{creatorAi.aspectRatio}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-500 block">Header / Magic:</span>
                                    <span className="text-neutral-200">{creatorAi.fileType.toUpperCase().replace('IMAGE/', '')} ({creatorAi.headerHex?.slice(0, 8)})</span>
                                  </div>
                                </div>

                                {creatorAi.detectedSoftware && (
                                  <div className="text-rose-400 font-mono text-[9px]">
                                    Tag: {creatorAi.detectedSoftware}
                                  </div>
                                )}

                                {creatorAi.redFlags.length > 0 && (
                                  <div className="space-y-1 pt-1 border-t border-neutral-800">
                                    <div className="text-rose-400 font-bold text-[9px]">Red Flags:</div>
                                    <div className="space-y-0.5 text-neutral-300 text-[9px]">
                                      {creatorAi.redFlags.map((flag: string, i: number) => (
                                        <div key={i} className="flex items-start gap-1">
                                          <span className="text-rose-400">·</span>
                                          <span>{flag}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>

                        {/* Rival Side */}
                        <div className="p-4 rounded-2xl bg-black/40 border border-neutral-800 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(match.opponent?.codmIgn || 'player')}`} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 object-cover shrink-0" />
                              <div className="min-w-0">
                                <div className="text-xs font-black text-white truncate">{match.opponent?.codmIgn || 'Awaiting Opponent'}</div>
                                <div className="text-[9px] text-neutral-500 font-mono">RIVAL · UID: {match.opponent?.codmUid?.slice(-6) || 'N/A'}</div>
                              </div>
                            </div>
                            <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border uppercase shrink-0 ${
                              match.opponent?.resultClaim === 'VICTORY'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : match.opponent?.resultClaim === 'DEFEAT'
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                : match.opponent?.resultClaim === 'DRAW'
                                ? 'bg-neutral-800 text-neutral-300 border-neutral-700'
                                : 'bg-neutral-900 text-neutral-500 border-neutral-800'
                            }`}>
                              {match.opponent?.resultClaim ? `CLAIM: ${match.opponent.resultClaim}` : 'NO CLAIM'}
                            </span>
                          </div>

                          {/* Rival Screenshot */}
                          <div className="space-y-2">
                            {match.opponent?.screenshotUrl ? (
                              <div
                                onClick={() => setLightboxData({
                                  url: match.opponent!.screenshotUrl!,
                                  playerIgn: match.opponent!.codmIgn,
                                  role: 'RIVAL',
                                  matchCode: match.challengeCode,
                                  systemAi: opponentAi
                                })}
                                className="relative aspect-video bg-black rounded-xl overflow-hidden border border-neutral-800 group/img cursor-pointer hover:border-amber-400/50 transition-all"
                              >
                                {match.opponent.screenshotUrl.startsWith('data:video/') ? (
                                  <video src={match.opponent.screenshotUrl} className="w-full h-full object-contain" />
                                ) : (
                                  <img src={match.opponent.screenshotUrl} alt="Rival proof" className="w-full h-full object-contain" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold">
                                  <ZoomIn size={16} />
                                  <span>Inspect Full-Res</span>
                                </div>
                                <span className="absolute top-2 left-2 text-[9px] font-mono font-bold bg-black/70 px-2 py-0.5 rounded border border-white/10 text-neutral-300">
                                  RIVAL PROOF
                                </span>
                              </div>
                            ) : (
                              <div className="aspect-video bg-neutral-950 rounded-xl border border-dashed border-neutral-800 flex flex-col items-center justify-center text-neutral-600 gap-1.5 text-xs">
                                <Camera size={20} className="opacity-40" />
                                <span className="text-[10px] font-mono uppercase">
                                  {match.opponent?.resubmissionRequested ? 'Resubmission Awaited' : 'No Proof Uploaded'}
                                </span>
                              </div>
                            )}

                            {/* Rival System Forensic Heuristics */}
                            {opponentAi ? (
                              <div className={`p-3 rounded-xl border text-[10px] space-y-2 ${
                                opponentAi.isLikelyFake
                                  ? 'bg-rose-950/20 border-rose-500/30'
                                  : 'bg-neutral-900/80 border-neutral-800'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-neutral-400 uppercase tracking-wider text-[9px]">System Forensic Check</span>
                                  <span className={`font-mono font-bold ${
                                    opponentAi.isLikelyFake ? 'text-rose-400' : 'text-emerald-400'
                                  }`}>
                                    {opponentAi.verdict} ({Math.round(opponentAi.confidenceScore * 100)}%)
                                  </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-neutral-400 font-mono text-[9px]">
                                  <div>
                                    <span className="text-neutral-500 block">Ratio / Size:</span>
                                    <span className="text-neutral-200">{opponentAi.aspectRatio}</span>
                                  </div>
                                  <div>
                                    <span className="text-neutral-500 block">Header / Magic:</span>
                                    <span className="text-neutral-200">{opponentAi.fileType.toUpperCase().replace('IMAGE/', '')} ({opponentAi.headerHex?.slice(0, 8)})</span>
                                  </div>
                                </div>

                                {opponentAi.detectedSoftware && (
                                  <div className="text-rose-400 font-mono text-[9px]">
                                    Tag: {opponentAi.detectedSoftware}
                                  </div>
                                )}

                                {opponentAi.redFlags.length > 0 && (
                                  <div className="space-y-1 pt-1 border-t border-neutral-800">
                                    <div className="text-rose-400 font-bold text-[9px]">Red Flags:</div>
                                    <div className="space-y-0.5 text-neutral-300 text-[9px]">
                                      {opponentAi.redFlags.map((flag: string, i: number) => (
                                        <div key={i} className="flex items-start gap-1">
                                          <span className="text-rose-400">·</span>
                                          <span>{flag}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Moderation Actions */}
                      <div className="pt-2 border-t border-neutral-800/80">
                        {!match.reviewerId ? (
                          <button
                            type="button"
                            onClick={() => handleClaimMatch(match.id)}
                            className="w-full py-4 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-amber-400/20 active:scale-[0.98]"
                          >
                            <Handshake size={20} />
                            <span>🤝 Claim for Review</span>
                          </button>
                        ) : match.reviewerId === currentUser.id ? (
                          <div className="flex flex-wrap items-center gap-3">
                            {/* 1. Approve Payout (Full Admin Only) */}
                                                            
{currentUser.role === 'admin' && (
                              <button
                                type="button"
                                onClick={() => setPayoutModal({
                                  isOpen: true,
                                  match,
                                  selectedWinnerId: match.creator.resultClaim === 'VICTORY' && match.opponent?.resultClaim !== 'VICTORY'
                                    ? match.creator.id
                                    : match.opponent?.resultClaim === 'VICTORY' && match.creator.resultClaim !== 'VICTORY'
                                    ? (match.opponent?.id || match.creator.id)
                                    : match.creator.id,
                                  isSubmitting: false,
                                  error: null,
                                })}
                                className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-98"
                              >
                                <CheckCircle size={15} />
                                <span>Approve Payout</span>
                              </button>
                            )}

                            {/* 2. Reject & Request Resubmission */}
                            <button
                              type="button"
                              onClick={() => setResubmitModal({
                                isOpen: true,
                                match,
                                targetPlayerId: 'both',
                                reason: hasAiFlags
                                  ? 'Uploaded screenshot contains synthetic AI artifacts or non-standard mobile dimensions. Please upload an authentic, unedited in-game landscape screenshot.'
                                  : 'Scoreboard proof rejected. Please upload an unedited full-screen CODM landscape scoreboard screenshot showing room code and player stats clearly.',
                                isSubmitting: false,
                                error: null,
                              })}
                              className="flex-1 py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-400/10 active:scale-98"
                            >
                              <RotateCcw size={15} />
                              <span>Reject & Request Resubmission</span>
                            </button>

                            {/* 3. Escalate to Manual Review */}
                            <button
                              type="button"
                              onClick={() => setEscalateModal({
                                isOpen: true,
                                match,
                                reason: match.conflictReason || 'Escalated by Admin for detailed referee inspection.',
                                isSubmitting: false,
                                error: null,
                              })}
                              className="py-3 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer border border-neutral-700 active:scale-98"
                            >
                              <Shield size={15} />
                              <span>Escalate</span>
                            </button>
                          </div>
                        ) : (
                          <div className="w-full py-4 px-4 rounded-xl bg-neutral-800/50 border border-neutral-800 text-neutral-500 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-3">
                            <Lock size={16} />
                            <span>Locked for Review by {match.reviewerName || 'Staff'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-20 text-center rounded-[2.5rem] bg-neutral-900 border border-dashed border-neutral-800 flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center text-emerald-400 border border-neutral-700">
                  <CheckCircle size={32} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xl font-black text-white uppercase tracking-tight">Review Queue Clear</h4>
                  <p className="text-neutral-500 text-xs font-medium max-w-sm">
                    All wager matches are verified, settled, or in progress. Zero pending proof conflicts or disputed screenshot queues.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB CONTENT: TREASURY */}
        {activeTab === 'finance' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1/3 h-full bg-gradient-to-l from-amber-400/5 to-transparent pointer-events-none" />
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10 border-b border-neutral-800/50 pb-8">
                <div className="space-y-1.5">
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Treasury Control</h3>
                  <p className="text-neutral-500 text-[13px] font-medium">Liquidity management for platform earnings.</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[1000, 5000, 10000, 20000].map(val => (
                    <button key={val} onClick={() => setWithdrawAmount(String(val))} className="px-5 py-2.5 bg-black border border-neutral-800 rounded-2xl text-[11px] font-mono font-black text-neutral-400 hover:text-amber-400 hover:border-amber-400/40 hover:shadow-lg hover:shadow-amber-400/5 transition-all duration-300">
                      ₦{val.toLocaleString()}
                    </button>
                  ))}
                  <button onClick={() => setWithdrawAmount(String(availableFees))} className="px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[11px] font-mono font-black text-emerald-400 hover:bg-emerald-500/20 transition-all">MAX</button>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3 relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-500 font-black text-xl pointer-events-none group-focus-within:text-amber-400 transition-colors">₦</div>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={e => setWithdrawAmount(e.target.value)}
                    placeholder="Enter cashout amount..."
                    className="w-full bg-black border border-neutral-800 rounded-[1.5rem] pl-14 pr-8 py-6 text-2xl font-mono font-black text-white focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-400/5 transition-all duration-500 placeholder:text-neutral-800"
                  />
                </div>
                <button
                  onClick={handleExecuteFeeWithdrawal}
                  disabled={isWithdrawing || !withdrawAmount}
                  className="bg-amber-400 text-black font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-xl shadow-amber-400/20 hover:bg-amber-300 disabled:opacity-30 disabled:grayscale transition-all active:scale-[0.98] flex items-center justify-center gap-3 h-full min-h-[70px]"
                >
                  {isWithdrawing ? <Loader2 size={24} className="animate-spin" /> : <ArrowUpRight size={24} />}
                  Execute
                </button>
              </div>

              {(withdrawSuccessMsg || withdrawErrorMsg) && (
                <div className={`mt-8 p-5 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest border animate-in fade-in slide-in-from-top-2 ${withdrawSuccessMsg ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                  <div className="flex items-center gap-3">
                    {withdrawSuccessMsg ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                    {withdrawSuccessMsg || withdrawErrorMsg}
                  </div>
                </div>
              )}
            </section>

            {/* FLUTTERWAVE PAYOUT GATEWAY & IP WHITELIST */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-neutral-800/50 pb-8 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                      Automated Bank Transfers (Flutterwave API)
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Live NGN Wallet Active
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Payout Gateway Diagnostics</h3>
                  <p className="text-neutral-500 text-xs mt-0.5">
                    Monitor live server outbound IP address, test bank payouts, and verify Flutterwave IP whitelisting.
                  </p>
                </div>
                <button
                  onClick={handleRunFlwTest}
                  disabled={flwTestLoading}
                  className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-cyan-500/10 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {flwTestLoading ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                  <span>Test ₦100 Payout to OPay</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Outbound IP Box */}
                <div className="p-6 rounded-2xl bg-black/60 border border-neutral-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                      <Shield size={16} /> Server Outbound IPv4
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText("34.34.246.125");
                        setCopiedIp(true);
                        setTimeout(() => setCopiedIp(false), 2500);
                      }}
                      className="text-[11px] font-bold text-neutral-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      {copiedIp ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedIp ? "Copied!" : "Copy IP"}</span>
                    </button>
                  </div>
                  <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl flex items-center justify-between">
                    <code className="text-base font-mono font-black text-cyan-400">34.34.246.125</code>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-neutral-800 text-neutral-400 rounded">Active Primary</span>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    If transfers return <em className="text-neutral-300">"This request cannot be processed..."</em>, add this IP in Flutterwave:
                    <br />
                    <strong className="text-neutral-200">dashboard.flutterwave.com &rarr; Settings &rarr; Security / API Keys &rarr; IP Whitelist</strong>.
                  </p>
                </div>

                {/* Account Details Box */}
                <div className="p-6 rounded-2xl bg-black/60 border border-neutral-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                      <CheckCircle2 size={16} /> Test Recipient Account
                    </span>
                    <span className="text-[10px] font-bold text-neutral-400">OPay Digital Bank</span>
                  </div>
                  <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono font-bold text-white">9151609682</span>
                      <span className="text-[10px] text-neutral-400">Code: 100004</span>
                    </div>
                    <p className="text-[11px] font-medium text-neutral-300">NURUDEEN BOLAJI ABDULSALAM</p>
                  </div>
                  <p className="text-[11px] text-neutral-400 leading-relaxed">
                    Atomic transaction rollback active: If Flutterwave rejects any payout, ₦0 is deducted and user balance is 100% protected.
                  </p>
                </div>
              </div>

              {flwTestResult && (
                <div className={`mt-6 p-5 rounded-2xl border text-xs space-y-2 animate-in fade-in duration-300 ${
                  flwTestResult.response?.status === 'success' || flwTestResult.response?.status === 'pending'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <div className="flex items-center gap-2">
                      {flwTestResult.response?.status === 'success' || flwTestResult.response?.status === 'pending' ? (
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                        <AlertCircle size={18} className="text-rose-400" />
                      )}
                      <span>
                        {flwTestResult.response?.status === 'success' || flwTestResult.response?.status === 'pending'
                          ? 'Flutterwave Transfer Initiated Successfully!'
                          : `Flutterwave Response: ${flwTestResult.response?.message || flwTestResult.error || 'Declined'}`}
                      </span>
                    </div>
                    <button onClick={() => setFlwTestResult(null)} className="text-neutral-400 hover:text-white cursor-pointer">
                      <X size={16} />
                    </button>
                  </div>
                  {flwTestResult.ipNotice && (
                    <div className="p-3 rounded-xl bg-black/40 border border-rose-500/20 text-neutral-300 space-y-1">
                      <p className="font-bold text-rose-300">Action Required in Flutterwave Dashboard:</p>
                      <p className="text-[11px]">{flwTestResult.ipNotice.instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* PLATFORM FEE CONFIGURATION (1v1 vs 5v5 SQUAD) */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-neutral-800/50 pb-8 mb-8">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20">
                      Rake & Commission Engine
                    </span>
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      Differentiated Rates Active
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Platform Fee Rates</h3>
                  <p className="text-neutral-500 text-xs mt-0.5">Configure dedicated platform fees for 1v1 duels vs 10-player 5v5 Squad battles.</p>
                </div>
                <button
                  onClick={handleSaveFeeSettings}
                  disabled={isSavingFees}
                  className="px-6 py-3 bg-emerald-400 hover:bg-emerald-300 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSavingFees ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>Save Fee Rates</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Solo 1v1 Setting */}
                <div className="p-6 rounded-2xl bg-black/60 border border-neutral-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-2">
                      <Zap size={16} /> Solo (1v1) Duel Fee
                    </span>
                    <span className="text-lg font-mono font-black text-white">{soloFeeRate}%</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">Standard platform fee applied to 2-player 1v1 duels. Default is 10%.</p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={soloFeeRate}
                      onChange={e => setSoloFeeRate(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 10)))}
                      className="w-24 bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-amber-400 focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                      {[7, 8, 10, 12].map(pct => (
                        <button
                          key={pct}
                          onClick={() => setSoloFeeRate(pct)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                            soloFeeRate === pct ? 'bg-amber-400 text-neutral-950' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 5v5 Squad Setting */}
                <div className="p-6 rounded-2xl bg-black/60 border border-emerald-500/40 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-2">
                      <Users size={16} /> 5v5 Squad ("Squared") Fee
                    </span>
                    <span className="text-lg font-mono font-black text-emerald-400">{squadFeeRate}%</span>
                  </div>
                  <p className="text-[11px] text-neutral-400">
                    Reduced platform fee for 10-player squad wagers to incentivize team coordination. Default is 5%.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={squadFeeRate}
                      onChange={e => setSquadFeeRate(Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 5)))}
                      className="w-24 bg-neutral-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:border-emerald-400 focus:outline-none"
                    />
                    <div className="flex gap-1.5">
                      {[4, 5, 7, 8].map(pct => (
                        <button
                          key={pct}
                          onClick={() => setSquadFeeRate(pct)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${
                            squadFeeRate === pct ? 'bg-emerald-400 text-neutral-950' : 'bg-neutral-800 text-neutral-400 hover:text-white'
                          }`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {feeSaveMsg && (
                <div className={`mt-5 p-4 rounded-xl text-xs font-bold flex items-center gap-2 border animate-in fade-in ${
                  feeSaveMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}>
                  {feeSaveMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{feeSaveMsg.text}</span>
                </div>
              )}
            </section>

            {/* SYSTEM MAINTENANCE PROTOCOL */}
            <section className="bg-neutral-900 border border-rose-500/30 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-rose-500 pointer-events-none group-hover:opacity-5 transition-opacity duration-700">
                <ShieldAlert size={160} />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest border ${maintenanceEnabled ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-neutral-800 text-neutral-500 border-neutral-700'}`}>
                      {maintenanceEnabled ? 'System Offline' : 'Systems Operational'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Maintenance Protocol</h3>
                  <p className="text-neutral-500 text-xs max-w-xl">
                    When active, all public pages and match creation are disabled for normal users. Only accounts with <strong className="text-white">Admin</strong> or <strong className="text-white">Moderator</strong> roles can bypass the lock.
                  </p>
                </div>

                <button
                  onClick={() => handleToggleMaintenance(!maintenanceEnabled)}
                  disabled={isTogglingMaintenance}
                  className={`px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95 flex items-center gap-3 ${maintenanceEnabled ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}
                >
                  {isTogglingMaintenance ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                  <span>{maintenanceEnabled ? 'Disable Maintenance' : 'Activate Maintenance'}</span>
                </button>
              </div>

              {maintenanceEnabled && (
                <div className="mt-8 p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 flex items-start gap-3 animate-in slide-in-from-top-2">
                  <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-rose-300 leading-relaxed font-medium">
                    <strong>Critical Alert:</strong> Maintenance mode is currently broadcasting an <strong>"Under Scheduled Maintenance"</strong> notice to all public visitors. Active matches can still be managed by admins, but no new challenges can be created by the player base.
                  </p>
                </div>
              )}
            </section>

            {/* TELEGRAM DIAGNOSTICS */}
            <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 sm:p-10 shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-sky-400 pointer-events-none group-hover:opacity-5 transition-opacity duration-700">
                <Send size={160} />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center gap-6 relative z-10 border-b border-neutral-800/50 pb-8 mb-8">
                 <div className="flex items-center gap-5">
                   <div className="w-16 h-16 rounded-[1.5rem] bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 shadow-lg shadow-sky-500/5 shrink-0">
                     <Send size={32} />
                   </div>
                   <div>
                     <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-tight">Bot Infrastructure</h3>
                     <p className="text-neutral-500 text-sm font-medium">Verify public channel connectivity and bot admin permissions.</p>
                   </div>
                 </div>
                 
                 <div className="px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-[10px] font-black text-sky-500 uppercase tracking-widest">
                   System Ready
                 </div>
              </div>

              <div className="space-y-6 relative z-10">
                 <div className="p-6 bg-black/40 rounded-2xl border border-neutral-800 space-y-4">
                    <p className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-2">Diagnostic Target ID</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input 
                        type="text"
                        placeholder="Default Channel ID (-100...)"
                        defaultValue="-1004368602897"
                        id="debug_channel_id"
                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-5 py-4 text-sm font-mono text-sky-400 focus:border-sky-400 focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                          const cid = (document.getElementById('debug_channel_id') as HTMLInputElement)?.value;
                          setTelegramTesting(true);
                          setTelegramTestMsg(null);
                          try {
                            const res = await fetch('/api/telegram/test-channel-post', {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'X-Admin-Id': currentUser.id,
                                'X-User-Id': currentUser.id
                              },
                              body: JSON.stringify({ userId: currentUser.id, channelId: cid }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              setTelegramTestMsg({ type: 'success', text: data.message || 'SUCCESS: Signal Delivered' });
                            } else {
                              setTelegramTestMsg({ type: 'error', text: data.error || 'FAILED: Link Broken' });
                            }
                          } catch (err: any) {
                            setTelegramTestMsg({ type: 'error', text: 'CONNECTION_ERROR' });
                          } finally {
                            setTelegramTesting(false);
                          }
                        }}
                        disabled={telegramTesting}
                        className="px-8 py-4 bg-sky-500 text-black font-black text-xs uppercase tracking-widest rounded-xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50"
                      >
                        {telegramTesting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} />}
                        <span>Execute Test Post</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-neutral-600 font-medium leading-relaxed italic">
                      Note: This will post a "CONNECTION TEST" message to the target channel. Ensure the bot is an Admin with "Post Messages" permission.
                    </p>
                 </div>

                 {telegramTestMsg && (
                   <div className={`p-5 rounded-2xl border text-xs font-black uppercase tracking-widest animate-in slide-in-from-top-2 flex flex-col gap-3 ${telegramTestMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
                     <div className="flex items-center gap-3">
                       {telegramTestMsg.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                       {telegramTestMsg.text}
                     </div>
                     {telegramTestMsg.type === 'error' && (
                       <div className="pt-3 border-t border-rose-500/10 space-y-2">
                         <p className="text-[10px] text-rose-300 normal-case font-medium leading-relaxed italic">
                           <b>Troubleshooting:</b> 1. Ensure the bot is an <b>ADMIN</b> in the channel. 2. Ensure you are using the correct <b>numerical ID</b> (usually starting with -100). 3. If it's a private group, send a message to the bot first.
                         </p>
                       </div>
                     )}
                   </div>
                 )}
              </div>
            </section>

            <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gradient-to-b from-black/20 to-transparent">
                <div className="space-y-1">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Inflow History</h3>
                   <p className="text-neutral-500 text-xs font-medium">Real-time ledger of automated rake deductions.</p>
                </div>
                <div className="px-4 py-2 bg-neutral-800/50 rounded-xl text-[10px] font-black text-neutral-400 uppercase tracking-widest border border-neutral-700/50">Recent Activity</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] border-b border-neutral-800 bg-black/40">
                      <th className="px-10 py-5">Match Sector</th>
                      <th className="px-10 py-5">Verification</th>
                      <th className="px-10 py-5">Pot Economics</th>
                      <th className="px-10 py-5 text-right">Rake (10%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/50">
                    {finance?.recent_fee_matches?.map(match => (
                      <tr key={match.id} className="hover:bg-white/[0.02] transition-all duration-300 group">
                        <td className="px-10 py-7">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center text-amber-400 border border-neutral-700/50 group-hover:border-amber-400/30 transition-all group-hover:bg-amber-400/5"><Target size={22} /></div>
                            <div>
                              <div className="text-[13px] font-black text-white uppercase tracking-tight">{match.gameMode}</div>
                              <div className="text-[10px] text-neutral-600 font-mono tracking-tighter mt-0.5">TERMNL_REF://{match.challengeCode}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-10 py-7">
                           <div className="space-y-1">
                             <div className="text-[10px] text-neutral-500 font-black uppercase tracking-widest opacity-60">Victor</div>
                             <div className="text-[12px] font-black text-amber-400">{match.winnerIgn}</div>
                           </div>
                        </td>
                        <td className="px-10 py-7">
                          <div className="space-y-1">
                            <div className="text-[12px] font-mono font-black text-neutral-300 tracking-tight">₦{match.potAmount.toLocaleString()} <span className="text-[10px] text-neutral-600 font-medium ml-1">POT</span></div>
                            <div className="text-[10px] text-neutral-600 font-black uppercase tracking-widest opacity-60">Stake: ₦{match.stakeAmount.toLocaleString()}</div>
                          </div>
                        </td>
                        <td className="px-10 py-7 text-right">
                          <div className="text-[18px] font-black text-emerald-400 font-mono tracking-tighter group-hover:scale-105 transition-transform origin-right">+₦{match.platformFee.toLocaleString()}</div>
                          <div className="text-[9px] font-mono font-bold uppercase tracking-wider mt-0.5">
                            {match.referralDeducted && match.referralDeducted > 0 ? (
                              <span className="text-amber-400">Net Rake (-₦{match.referralDeducted.toLocaleString()} Referral Reward)</span>
                            ) : (
                              <span className="text-neutral-500">Net Admin Rake</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!finance?.recent_fee_matches || finance.recent_fee_matches.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-10 py-20 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                            <HistoryIcon size={64} className="text-neutral-500" />
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">Ledger Empty</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* TAB CONTENT: USERS */}
        {activeTab === 'users' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-2">
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Gladiator Roster & Permissions</h3>
                  <p className="text-xs text-neutral-500 mt-1">Manage operator clearance levels and role assignments.</p>
                </div>
                <button
                  onClick={() => setGrantModal({ isOpen: true, identifier: "", role: "admin", submitting: false, message: null, error: null })}
                  className="px-8 py-4 bg-amber-400 hover:bg-amber-300 text-black font-black rounded-2xl text-[11px] uppercase tracking-widest shadow-xl shadow-amber-400/10 flex items-center gap-3 transition-all active:scale-95 shrink-0"
                >
                  <ShieldCheck size={18} />
                  Grant Admin Privileges
                </button>
              </div>
             <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
               <div className="flex flex-col md:flex-row gap-6 items-center relative z-10">
                 <div className="relative flex-1 w-full group">
                   <Search size={22} className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-amber-400 transition-colors" />
                   <input
                    type="text"
                    value={usersSearch}
                    onChange={e => setUsersSearch(e.target.value)}
                    placeholder="Search by IGN, Email or Phone Terminal..."
                    className="w-full bg-black border border-neutral-800 rounded-[1.5rem] pl-16 pr-8 py-5 text-[15px] font-bold text-white focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-400/5 transition-all duration-300 placeholder:text-neutral-800 placeholder:font-black placeholder:uppercase placeholder:tracking-widest placeholder:text-[11px]"
                   />
                 </div>
                 <div className="flex p-1.5 bg-black rounded-[1.25rem] border border-neutral-800 w-full md:w-auto shadow-inner">
                    {(['all', 'admin', 'moderator', 'user'] as const).map(f => (
                      <button key={f} onClick={() => setRoleFilter(f)} className={`px-8 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${roleFilter === f ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/20' : 'text-neutral-500 hover:text-white hover:bg-neutral-800/50'}`}>{f}</button>
                    ))}
                 </div>
               </div>
             </section>

             <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] border-b border-neutral-800 bg-black/40">
                        <th className="px-10 py-5">Identity Profile</th>
                        <th className="px-10 py-5">Financial Status</th>
                        <th className="px-10 py-5">Permission Level</th>
                        <th className="px-10 py-5 text-right">Admin Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                      {filteredUsers.map(u => (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-all duration-300 group">
                          <td className="px-10 py-7">
                            <div className="flex items-center gap-5">
                              <div className="w-14 h-14 rounded-[1.25rem] bg-neutral-800 flex items-center justify-center text-amber-400 font-black text-2xl border border-neutral-700/50 group-hover:scale-105 transition-all group-hover:bg-amber-400/5 group-hover:border-amber-400/30">
                                {u.codmIgn?.slice(0, 1).toUpperCase() || 'U'}
                              </div>
                              <div>
                                <div className="text-[14px] font-black text-white uppercase tracking-tight">{u.codmIgn}</div>
                                <div className="text-[10px] text-neutral-500 font-mono truncate max-w-[180px] mt-1 opacity-70 group-hover:opacity-100 transition-opacity">{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-7">
                            <div className="space-y-1">
                              <div className="text-[16px] font-black text-white font-mono tracking-tighter group-hover:text-emerald-400 transition-colors">₦{(u.balance || 0).toLocaleString()}</div>
                              <div className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em]">Liquid Balance</div>
                            </div>
                          </td>
                          <td className="px-10 py-7">
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black border tracking-widest ${u.role === 'admin' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : u.role === 'banned' ? 'bg-rose-950/40 border-rose-500/40 text-rose-400 font-bold' : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-500'}`}>
                               {u.role.toUpperCase()}
                             </span>
                          </td>
                          <td className="px-10 py-7 text-right">
                             <div className="flex items-center justify-end gap-3">
                               {u.role === 'banned' && (
                                 <button
                                   onClick={async () => {
                                     if (confirm(`Unban account for ${u.codmIgn}?`)) {
                                       try {
                                         await unbanAccount(currentUser.id, u.id);
                                         loadUsers();
                                       } catch (err: any) {
                                         alert(err.message || 'Failed to unban account');
                                       }
                                     }
                                   }}
                                   className="p-3 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-2xl transition-all border border-emerald-500/20 active:scale-90"
                                   title="Unban Account"
                                 >
                                   <UserCheck size={18} />
                                 </button>
                               )}
                               <button 
                                onClick={() => setBalanceModal({ ...balanceModal, isOpen: true, user: u })} 
                                className="p-3 bg-neutral-800 hover:bg-amber-400/10 text-amber-400 rounded-2xl transition-all border border-neutral-800 hover:border-amber-400/40 active:scale-90"
                                title="Adjust Balance"
                               >
                                 <Coins size={18} />
                               </button>
                               {currentUser.role === 'admin' && (
                                 <button 
                                  onClick={async () => { 
                                    const roles: ('user' | 'moderator' | 'admin')[] = ['user', 'moderator', 'admin'];
                                    const currentIndex = roles.indexOf(u.role as any);
                                    const nextRole = roles[(currentIndex + 1) % roles.length];
                                    if(confirm(`Promote/Demote ${u.codmIgn} to ${nextRole.toUpperCase()}?`)) { 
                                      await assignUserRole(currentUser.id, { targetUserId: u.id, role: nextRole }); 
                                      loadUsers(); 
                                    } 
                                  }} 
                                  className={`p-3 rounded-2xl transition-all border border-neutral-800 active:scale-90 ${u.role === 'admin' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' : u.role === 'moderator' ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
                                  title={`Change Role (Current: ${u.role})`}
                                 >
                                   <Shield size={18} />
                                 </button>
                               )}
                               {currentUser.role === 'admin' && u.email !== 'b@gmail.com' && (
                                 <button 
                                   onClick={async () => { 
                                     if(confirm(`⚠️ CRITICAL: Permanently purge gladiator ${u.codmIgn} and all their history? This cannot be undone.`)) { 
                                       try {
                                         await deleteUser(currentUser.id, u.id);
                                         loadUsers();
                                       } catch (err: any) {
                                         alert(err.message || 'Failed to delete user');
                                       }
                                     } 
                                   }} 
                                   className="p-3 bg-rose-900/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all border border-neutral-800 hover:border-rose-500 active:scale-90"
                                   title="Purge User Record"
                                 >
                                   <Trash2 size={18} />
                                 </button>
                               )}
                             </div>
                          </td>
                        </tr>
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-10 py-20 text-center">
                            <div className="flex flex-col items-center gap-4 opacity-20">
                              <Search size={64} className="text-neutral-500" />
                              <p className="text-xs font-black uppercase tracking-[0.3em] text-neutral-400">No Gladiators Matching ID</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </section>
          </div>
        )}

        {/* TAB CONTENT: DISPUTES */}
        {activeTab === 'disputes' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <header className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="space-y-1.5">
                   <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Dispute Review Center</h3>
                   <p className="text-neutral-500 text-[13px] font-medium">Verify scoreboard screenshots and resolve gladiator conflicts.</p>
                </div>
                <div className="flex items-center gap-3">
                   <div className="px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-[10px] font-black text-rose-500 uppercase tracking-widest">
                     {disputesList.filter(d => d.status === 'DISPUTED').length} URGENT
                   </div>
                   <button onClick={loadDisputes} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white transition-all"><RefreshCw size={18} /></button>
                </div>
             </header>

             <div className="grid grid-cols-1 gap-6">
                {disputesList.map(match => (
                  <div key={match.id} className={`p-8 rounded-[2.5rem] bg-neutral-900 border transition-all duration-500 shadow-2xl relative overflow-hidden group ${match.status === 'DISPUTED' ? 'border-rose-500/40' : 'border-neutral-800'}`}>
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-rose-400 pointer-events-none group-hover:opacity-[0.06] transition-opacity duration-700">
                      <Target size={160} />
                    </div>
                    
                     <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-10 relative z-10">
                      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center border-2 ${match.status === 'DISPUTED' ? 'bg-rose-500/10 border-rose-400 text-rose-400 shadow-lg shadow-rose-500/10' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>
                           <AlertTriangle size={32} />
                        </div>
                        <div className="text-center sm:text-left space-y-2">
                           <div className="flex items-center justify-center sm:justify-start gap-3">
                             <h4 className="text-xl font-black text-white uppercase tracking-tighter">Match #{match.challengeCode}</h4>
                             <span className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest uppercase border ${match.status === 'DISPUTED' ? 'bg-rose-500/20 border-rose-500/40 text-rose-400 animate-pulse' : 'bg-neutral-800 border-neutral-700 text-neutral-500'}`}>{match.status}</span>
                           </div>
                           <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                             <span className="text-xs font-bold text-neutral-400 uppercase tracking-wide">{match.gameMode} · {match.map}</span>
                             <div className="h-3 w-px bg-neutral-800" />
                             <span className="text-xs font-mono font-black text-amber-400">₦{match.potAmount.toLocaleString()} POT</span>
                           </div>
                           <p className="text-[10px] text-neutral-600 font-mono tracking-tighter uppercase">{new Date(match.createdAt).toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <button 
                          onClick={() => setSelectedDispute(match)}
                          className="flex-1 lg:flex-none px-8 py-4 bg-amber-400 text-black font-black uppercase text-[11px] tracking-widest rounded-2xl hover:bg-amber-300 transition-all shadow-xl shadow-amber-400/10 flex items-center justify-center gap-2"
                        >
                          <Eye size={18} /> Review Proof
                        </button>
                      </div>
                    </div>

                    {/* Telegram Admin Group Evidence Verification Box */}
                    <div className="mt-6 p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 space-y-3 relative z-10">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-2">
                        <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                          <Send size={15} className="text-cyan-400 shrink-0" />
                          <span>Telegram Admin Group Evidence Verification</span>
                        </div>
                        <a
                          href="https://t.me/+I5vcFF4RXwJkMWVk"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-mono font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-500/10 px-2.5 py-1 rounded-lg border border-cyan-500/30 transition-all cursor-pointer"
                        >
                          <span>Open Telegram Admin Group</span>
                          <ExternalLink size={12} />
                        </a>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                        <div className="p-2.5 bg-black/60 rounded-xl border border-neutral-800">
                          <span className="text-[10px] text-neutral-500 block font-sans font-bold uppercase">Host Username</span>
                          <span className="text-white font-bold">{match.creator.codmIgn}</span>
                        </div>
                        <div className="p-2.5 bg-black/60 rounded-xl border border-neutral-800">
                          <span className="text-[10px] text-neutral-500 block font-sans font-bold uppercase">Rival Username</span>
                          <span className="text-white font-bold">{match.opponent?.codmIgn || 'Awaiting Opponent'}</span>
                        </div>
                        <div className="p-2.5 bg-black/60 rounded-xl border border-neutral-800">
                          <span className="text-[10px] text-neutral-500 block font-sans font-bold uppercase">Room Code</span>
                          <span className="text-amber-400 font-bold">{match.roomCode || match.challengeCode}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleCopyTag(`#DISPUTE_${match.roomCode || match.challengeCode}`, `disp_tag_${match.id}`)}
                          className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedTag === `disp_tag_${match.id}` ? (
                            <><Check size={13} className="text-emerald-400 stroke-[3]" /> Copied Search Tag!</>
                          ) : (
                            <><Copy size={13} /> Copy Search Tag (#DISPUTE_{match.roomCode || match.challengeCode})</>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyTag(match.roomCode || match.challengeCode, `disp_code_${match.id}`)}
                          className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                        >
                          {copiedTag === `disp_code_${match.id}` ? (
                            <><Check size={13} className="text-emerald-400 stroke-[3]" /> Copied Room Code!</>
                          ) : (
                            <><Copy size={13} /> Copy Room Code ({match.roomCode || match.challengeCode})</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {disputesList.length === 0 && (
                  <div className="p-32 text-center rounded-[3rem] bg-neutral-900 border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center space-y-6">
                    <div className="w-24 h-24 rounded-[2rem] bg-neutral-800 flex items-center justify-center text-neutral-600">
                      <Shield size={48} />
                    </div>
                    <div className="space-y-2">
                       <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Sector Secure</h3>
                       <p className="text-neutral-500 text-sm font-medium uppercase tracking-widest opacity-60">No active match conflicts detected in arena logs.</p>
                    </div>
                  </div>
                )}
             </div>
          </div>
        )}

        {/* TAB CONTENT: GMAIL */}
        {activeTab === 'gmail' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
             <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-400/30 to-transparent" />
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 relative z-10 border-b border-neutral-800/50 pb-10">
                 <div className="space-y-1.5">
                   <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Sync Engine</h3>
                   <p className="text-neutral-500 text-[13px] font-medium">Automated IMAP SSL fetch for deposit alerts.</p>
                 </div>
                 <div className="flex gap-4 w-full md:w-auto">
                    {gmailStatus?.configured ? (
                      <>
                        <button onClick={handleSyncGmail} disabled={gmailSyncing} className="flex-1 md:flex-none px-8 py-4 bg-amber-400 text-black font-black rounded-2xl text-[11px] uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl shadow-amber-400/10 hover:bg-amber-300 transition-all active:scale-95">
                          <RefreshCw size={18} className={gmailSyncing ? 'animate-spin' : ''} /> Force Sync
                        </button>
                        <button onClick={handleDisconnectGmail} className="flex-1 md:flex-none px-8 py-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black rounded-2xl text-[11px] uppercase tracking-widest hover:bg-rose-500/20 transition-all active:scale-95">Disconnect</button>
                      </>
                    ) : (
                      <button onClick={() => setConnectModalOpen(true)} className="w-full md:w-auto px-10 py-5 bg-amber-400 text-black font-black rounded-[1.5rem] text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-amber-400/20 hover:bg-amber-300 transition-all animate-pulse">Connect Sync Terminal</button>
                    )}
                 </div>
               </div>
               
               {gmailStatus?.configured && (
                 <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="p-6 bg-black/40 rounded-[1.5rem] border border-neutral-800/50 hover:border-emerald-500/30 transition-colors duration-500 group">
                      <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest mb-2 group-hover:text-emerald-500/60 transition-colors">Relay Status</p>
                      <p className="text-emerald-400 font-mono font-black text-lg tracking-tighter">CONNECTED & READY</p>
                   </div>
                   <div className="p-6 bg-black/40 rounded-[1.5rem] border border-neutral-800/50 hover:border-amber-500/30 transition-colors duration-500 group">
                      <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest mb-2 group-hover:text-amber-500/60 transition-colors">Last Handshake</p>
                      <p className="text-white font-mono font-black text-[15px] tracking-tight truncate">{gmailStatus.lastSyncedAt ? new Date(gmailStatus.lastSyncedAt).toLocaleString() : 'WAITING FOR SYNC...'}</p>
                   </div>
                   <div className="p-6 bg-black/40 rounded-[1.5rem] border border-neutral-800/50 hover:border-amber-500/30 transition-colors duration-500 group">
                      <p className="text-[10px] text-neutral-600 font-black uppercase tracking-widest mb-2 group-hover:text-amber-500/60 transition-colors">Stored Logs</p>
                      <p className="text-amber-400 font-mono font-black text-lg tracking-tighter">{emailsList.length} SYNC_ITEMS</p>
                   </div>
                 </div>
               )}
             </section>

             <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl">
               <div className="p-10 border-b border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-gradient-to-b from-black/20 to-transparent">
                 <div className="space-y-1.5">
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Live Logs Inbox</h3>
                   <p className="text-neutral-500 text-xs font-medium">Synced payment alerts and incoming notifications.</p>
                 </div>
                 <div className="relative group w-full md:w-auto">
                   <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-amber-400 transition-colors" />
                   <input type="text" value={emailSearch} onChange={e => setEmailSearch(e.target.value)} placeholder="Filter logs sector..." className="bg-black border border-neutral-800 rounded-2xl pl-12 pr-6 py-3.5 text-xs font-bold text-white focus:border-amber-400 focus:outline-none w-full md:w-72 shadow-inner placeholder:text-neutral-800 placeholder:uppercase placeholder:tracking-widest" />
                 </div>
               </div>
               <div className="divide-y divide-neutral-800/50">
                 {emailsList.filter(e => (e.subject + e.senderName + e.body).toLowerCase().includes(emailSearch.toLowerCase())).map(email => (
                   <div key={email.id} onClick={() => setEmailViewerModal(email)} className="p-8 flex items-start justify-between gap-6 hover:bg-white/[0.02] cursor-pointer transition-all duration-300 group">
                     <div className="flex gap-6 min-w-0">
                       <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 transition-all duration-500 border border-transparent ${email.isRead ? 'bg-neutral-800 text-neutral-600' : 'bg-amber-400 text-black shadow-xl shadow-amber-400/10 border-amber-400/50 group-hover:scale-105'}`}>
                         {email.senderName?.charAt(0).toUpperCase() || 'M'}
                       </div>
                       <div className="space-y-1.5 min-w-0">
                         <div className="flex items-center gap-3">
                           <span className={`text-[11px] font-black uppercase tracking-widest ${email.isRead ? 'text-neutral-600' : 'text-white'}`}>{email.senderName || 'Terminal Node'}</span>
                           {email.isVerified && <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-emerald-500/20 shadow-lg shadow-emerald-500/5"><Check size={10} strokeWidth={4} /> Verified</div>}
                         </div>
                         <h4 className={`text-[15px] leading-tight truncate max-w-xl transition-all ${email.isRead ? 'text-neutral-600 font-medium' : 'text-amber-400 font-black'}`}>{email.subject}</h4>
                         <p className="text-[12px] text-neutral-500 line-clamp-1 opacity-60 font-medium group-hover:opacity-100 transition-opacity">{email.body}</p>
                       </div>
                     </div>
                     <div className="text-right flex flex-col justify-between items-end h-14 shrink-0">
                       <span className="text-[10px] text-neutral-700 font-mono font-bold tracking-tight opacity-70">{new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       <button onClick={async (e) => { e.stopPropagation(); if(confirm('Purge log entry permanently?')) { await deleteAdminEmail(currentUser.id, email.id); loadGmail(); } }} className="p-2.5 text-neutral-800 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all active:scale-75"><Trash2 size={16} /></button>
                     </div>
                   </div>
                 ))}
                 {emailsList.length === 0 && (
                    <div className="p-24 text-center space-y-4">
                       <div className="w-20 h-24 bg-neutral-800/30 rounded-[2rem] flex items-center justify-center mx-auto opacity-20"><Inbox size={48} /></div>
                       <p className="text-[11px] font-black text-neutral-600 uppercase tracking-[0.4em]">Inbox Clear</p>
                    </div>
                 )}
               </div>
             </section>
          </div>
        )}



        {/* TAB CONTENT: STANDARDIZED SUPPORT HELPDESK INBOX */}
        {activeTab === 'support' && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-neutral-900 border border-neutral-800 p-6 rounded-[2.5rem] shadow-xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 font-black shrink-0">
                  <Headphones size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                    <span>Helpdesk Support Inbox</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-400 text-[10px] font-mono font-bold">
                      {supportConversations.length} {supportConversations.length === 1 ? 'Ticket' : 'Tickets'}
                    </span>
                  </h2>
                  <p className="text-xs text-neutral-500 font-medium">
                    Standardized two-pane player communication desk & live resolution workspace.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={loadSupportMessages}
                  className="px-5 py-3 bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer active:scale-95 shadow-md"
                >
                  <RefreshCw size={15} className={loadingSupport ? 'animate-spin' : ''} />
                  <span>Sync Conversations</span>
                </button>
              </div>
            </div>

            {/* TWO-PANE HELPDESK LAYOUT */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
              {/* LEFT PANE: CONVERSATION ROSTER & FILTERS */}
              <div className="lg:col-span-5 xl:col-span-4 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-5 shadow-2xl flex flex-col space-y-4">
                {/* Search & Filter Bar */}
                <div className="space-y-3">
                  <div className="relative group">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type="text"
                      value={supportSearch}
                      onChange={(e) => setSupportSearch(e.target.value)}
                      placeholder="Search player IGN, ID, or text..."
                      className="w-full bg-black border border-neutral-800 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold text-white focus:border-amber-400 focus:outline-none transition-all placeholder:text-neutral-600"
                    />
                  </div>

                  {/* Category Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {['all', 'Deposit Issue', 'Result Dispute', 'Withdrawal Issue', 'General Inquiry'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setSupportCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                          supportCategoryFilter === cat
                            ? 'bg-amber-400 text-neutral-950 shadow-md font-bold'
                            : 'bg-neutral-950 text-neutral-500 hover:text-white border border-neutral-800'
                        }`}
                      >
                        {cat === 'all' ? 'All Queries' : cat.replace(' Issue', '')}
                      </button>
                    ))}
                  </div>

                  {/* Status Filter Pills */}
                  <div className="flex items-center gap-2 pt-1 border-t border-neutral-800/60">
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest">Status:</span>
                    {['all', 'open', 'resolved'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setSupportStatusFilter(st)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-mono font-bold uppercase transition-all cursor-pointer ${
                          supportStatusFilter === st
                            ? 'bg-neutral-800 text-amber-400 border border-amber-400/30'
                            : 'text-neutral-600 hover:text-neutral-300'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conversation List Stream */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[500px] lg:max-h-[550px]">
                  {loadingSupport && supportConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                      <Loader2 size={32} className="text-amber-400 animate-spin" />
                      <p className="text-xs font-mono font-bold text-neutral-500 uppercase">Loading Support Tickets...</p>
                    </div>
                  ) : supportConversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 opacity-40">
                      <MessageCircle size={40} className="text-neutral-600" />
                      <p className="text-xs font-black uppercase tracking-widest text-neutral-400">No Support Queries</p>
                    </div>
                  ) : (
                    supportConversations
                      .filter((c) => {
                        const q = supportSearch.toLowerCase().trim();
                        const pName = ((c as any).playerName || c.senderName || '').toLowerCase();
                        const uid = (c.userId || (c as any).user_id || '').toLowerCase();
                        const txt = (c.text || '').toLowerCase();
                        const matchesSearch = !q || pName.includes(q) || uid.includes(q) || txt.includes(q);

                        const matchesCategory = supportCategoryFilter === 'all' || (c.category || 'General Inquiry') === supportCategoryFilter;
                        const matchesStatus = supportStatusFilter === 'all' || (c.status || 'open') === supportStatusFilter;

                        return matchesSearch && matchesCategory && matchesStatus;
                      })
                      .map((conv) => {
                        const uid = conv.userId || (conv as any).user_id;
                        const isSelected = selectedSupportUserId === uid;
                        const pName = (conv as any).playerName || conv.senderName || 'Player';
                        const initial = pName.charAt(0).toUpperCase() || 'P';
                        const isStaffLast = conv.senderRole === 'admin' || conv.senderRole === 'super_admin' || conv.senderRole === 'moderator';

                        return (
                          <div
                            key={conv.id}
                            onClick={() => {
                              setSelectedSupportUserId(uid);
                              loadSupportThread(uid);
                            }}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col space-y-2 ${
                              isSelected
                                ? 'bg-amber-400/10 border-amber-400/60 shadow-lg shadow-amber-400/5'
                                : 'bg-black/40 border-neutral-800/80 hover:border-neutral-700 hover:bg-black/60'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                                  isSelected ? 'bg-amber-400 text-neutral-950 border-amber-300' : 'bg-neutral-800 text-amber-400 border-neutral-700'
                                }`}>
                                  {initial}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-white uppercase truncate flex items-center gap-1.5">
                                    <span>{pName}</span>
                                    {conv.status === 'resolved' ? (
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Ticket Resolved" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title="Open Ticket" />
                                    )}
                                  </div>
                                  <div className="text-[9px] text-neutral-500 font-mono">
                                    ID: {uid ? uid.slice(-8) : 'N/A'}
                                  </div>
                                </div>
                              </div>

                              <span className="text-[9px] text-neutral-600 font-mono shrink-0">
                                {conv.timestamp ? new Date(conv.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-[10px] gap-2 pt-1 border-t border-neutral-800/40">
                              <span className="truncate text-neutral-400 font-medium">
                                <b className={isStaffLast ? 'text-amber-400 font-bold' : 'text-neutral-300 font-bold'}>
                                  {isStaffLast ? 'Staff: ' : 'User: '}
                                </b>
                                {conv.text}
                              </span>
                              {conv.category && (
                                <span className="px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono text-[8px] uppercase border border-neutral-700 shrink-0">
                                  {conv.category.replace(' Issue', '')}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

              {/* RIGHT PANE: ACTIVE CONVERSATION THREAD & LIVE WORKSPACE */}
              <div className="lg:col-span-7 xl:col-span-8 bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-6 shadow-2xl flex flex-col justify-between space-y-4">
                {!selectedSupportUserId ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4 opacity-50">
                    <div className="w-20 h-20 rounded-3xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400">
                      <Headphones size={40} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Select a Support Ticket</h3>
                      <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                        Choose a player conversation from the left roster to view full thread history and reply.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Thread Header */}
                    {(() => {
                      const activeConv = supportConversations.find((c) => (c.userId || (c as any).user_id) === selectedSupportUserId);
                      const pName = (activeConv as any)?.playerName || activeConv?.senderName || 'Player';

                      return (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800/80">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-400 font-black text-lg flex items-center justify-center shrink-0">
                              {pName.charAt(0).toUpperCase() || 'P'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-black text-white uppercase tracking-tight">{pName}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${
                                  activeConv?.status === 'resolved'
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
                                }`}>
                                  {activeConv?.status || 'open'}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono mt-0.5">
                                <span>User ID: {selectedSupportUserId}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(selectedSupportUserId);
                                    setCopiedSupportUserId(true);
                                    setTimeout(() => setCopiedSupportUserId(false), 2000);
                                  }}
                                  className="text-amber-400 hover:text-white flex items-center gap-1 font-bold cursor-pointer transition-colors"
                                  title="Copy User ID"
                                >
                                  {copiedSupportUserId ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                  <span>{copiedSupportUserId ? 'Copied!' : 'Copy'}</span>
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => loadSupportThread(selectedSupportUserId)}
                              className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer"
                              title="Refresh Thread"
                            >
                              <RefreshCw size={15} className={loadingThread ? 'animate-spin' : ''} />
                            </button>

                            {activeConv?.status !== 'resolved' ? (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Mark support ticket for ${pName} as resolved?`)) return;
                                  try {
                                    const res = await fetch('/api/support/resolve', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: selectedSupportUserId })
                                    });
                                    if (res.ok) {
                                      setSupportConversations((prev) =>
                                        prev.map((c) => (c.userId || (c as any).user_id) === selectedSupportUserId ? { ...c, status: 'resolved' } : c)
                                      );
                                      loadSupportThread(selectedSupportUserId);
                                    }
                                  } catch {
                                    alert('Failed to resolve ticket');
                                  }
                                }}
                                className="px-4 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <CheckCircle size={14} />
                                <span>Resolve Ticket</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!confirm(`Clear entire chat history for ${pName}?`)) return;
                                  try {
                                    const res = await fetch(`/api/support/messages?userId=${selectedSupportUserId}`, { method: 'DELETE' });
                                    if (res.ok) {
                                      setSupportConversations((prev) => prev.filter((c) => (c.userId || (c as any).user_id) !== selectedSupportUserId));
                                      setActiveThreadMessages([]);
                                      setSelectedSupportUserId(null);
                                    }
                                  } catch {
                                    alert('Failed to clear history');
                                  }
                                }}
                                className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                              >
                                <Trash2 size={14} />
                                <span>Clear Chat</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Thread Message Stream */}
                    <div className="flex-1 overflow-y-auto space-y-3 p-4 bg-black/60 rounded-2xl border border-neutral-800/80 max-h-[380px] min-h-[320px]">
                      {loadingThread && activeThreadMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2">
                          <Loader2 size={28} className="text-amber-400 animate-spin" />
                          <p className="text-xs font-mono font-bold text-neutral-500 uppercase">Fetching Full Conversation...</p>
                        </div>
                      ) : activeThreadMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-2 opacity-40">
                          <MessageCircle size={32} className="text-neutral-600" />
                          <p className="text-xs font-black uppercase tracking-widest text-neutral-400">No Messages in Thread</p>
                        </div>
                      ) : (
                        activeThreadMessages.map((msg) => {
                          const isStaff = msg.senderRole === 'admin' || msg.senderRole === 'super_admin' || msg.senderRole === 'moderator';

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'}`}
                            >
                              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-mono">
                                <span className="font-bold text-neutral-400 uppercase">
                                  {msg.senderName}
                                </span>
                                {isStaff && (
                                  <span className="px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-400 font-bold text-[8px] uppercase border border-amber-400/30">
                                    STAFF
                                  </span>
                                )}
                                {msg.category && !isStaff && (
                                  <span className="px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-500 text-[8px] uppercase border border-neutral-700">
                                    {msg.category}
                                  </span>
                                )}
                                <span className="text-neutral-600">
                                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <div
                                className={`p-3.5 rounded-2xl text-xs leading-relaxed max-w-[85%] break-words ${
                                  isStaff
                                    ? 'bg-amber-400 text-neutral-950 font-medium rounded-tr-sm shadow-md'
                                    : 'bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-tl-sm shadow-sm'
                                }`}
                              >
                                {msg.text}
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={threadEndRef} />
                    </div>

                    {/* Quick Canned Response Templates */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">
                        Quick Response Templates:
                      </div>
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {[
                          { label: '💳 Verify Deposit', text: 'Your deposit session is being verified with our payment gateway. Please allow a moment.' },
                          { label: '🛡️ Referee Review', text: 'Your match dispute and scoreboard screenshot are currently under manual referee audit.' },
                          { label: '💸 Payout Sent', text: 'Your withdrawal request has been authorized and dispatched to your bank account.' },
                          { label: '✅ Issue Resolved', text: 'Your support inquiry has been resolved. Please let us know if you need any further assistance!' }
                        ].map((tpl, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setComposerText(tpl.text)}
                            className="px-3 py-1.5 rounded-xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-[10px] text-neutral-300 font-mono font-bold shrink-0 transition-all cursor-pointer"
                          >
                            {tpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Reply Composer */}
                    <div className="space-y-2 pt-1 border-t border-neutral-800/80">
                      <textarea
                        value={composerText}
                        onChange={(e) => setComposerText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendSupportReply();
                          }
                        }}
                        placeholder="Type tactical support reply to gladiator... (Press Enter to send)"
                        className="w-full bg-black border border-neutral-800 focus:border-amber-400 rounded-2xl px-4 py-3 text-xs text-white outline-none transition-all resize-none h-20 placeholder:text-neutral-600"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-neutral-500 font-mono">
                          Press <b>Enter</b> to send message · <b>Shift+Enter</b> for new line
                        </span>
                        <button
                          type="button"
                          onClick={handleSendSupportReply}
                          disabled={!composerText.trim()}
                          className="px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-amber-400/10 flex items-center gap-2 cursor-pointer active:scale-95"
                        >
                          <Send size={15} />
                          <span>Dispatch Reply</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                    <Settings size={22} />
                  </div>
                  <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">Maintenance & Server IP</h3>
                </div>
                <p className="text-neutral-500 text-[13px] font-medium">
                  Control public arena availability, inspect outbound server IP, and configure Flutterwave payout whitelisting.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    loadMaintenanceStatus();
                    loadServerIp();
                    loadActiveBroadcast();
                  }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg"
                >
                  <RefreshCw size={14} className={serverIpLoading ? 'animate-spin' : ''} />
                  <span>Refresh Status</span>
                </button>
              </div>
            </header>

            {/* GLOBAL BROADCAST BANNER COMMAND CENTER */}
            <section className="bg-neutral-900 border border-neutral-800 p-8 md:p-10 rounded-[2.5rem] shadow-2xl space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-800/80 pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <Megaphone size={24} />
                  </div>
                  <div>
                    <h4 className="text-2xl font-black text-white uppercase tracking-tight">Global Marquee Broadcast Command Center</h4>
                    <p className="text-xs text-neutral-400 font-medium">Broadcast instant live announcements, maintenance warnings, or promotional event alerts to all connected players across the app.</p>
                  </div>
                </div>
                {currentActiveBroadcast && (
                  <span className="px-3.5 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-cyan-400" />
                    BROADCAST LIVE NOW
                  </span>
                )}
              </div>

              {/* Active Broadcast Indicator */}
              {currentActiveBroadcast ? (
                <div className="p-5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Active Announcement ({currentActiveBroadcast.type?.toUpperCase()})</span>
                    <p className="text-sm font-bold text-white font-mono">{currentActiveBroadcast.message}</p>
                  </div>
                  <button
                    onClick={() => handleClearBroadcast()}
                    disabled={isPublishingBroadcast}
                    className="px-5 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/20 shrink-0"
                  >
                    Clear Active Broadcast
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-black/40 border border-neutral-800/60 text-xs text-neutral-500 font-mono flex items-center gap-2">
                  <Sparkles size={14} className="text-amber-400 shrink-0" />
                  <span>No active broadcast marquee currently running. Enter a message below to broadcast live.</span>
                </div>
              )}

              {/* Broadcast Composer Form */}
              <form onSubmit={handlePublishBroadcast} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Broadcast Alert Type</label>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { id: 'warning', label: '⚠️ Warning (Amber)', color: 'border-amber-500/50 bg-amber-500/10 text-amber-300' },
                      { id: 'urgent', label: '🚨 Urgent Maintenance (Rose)', color: 'border-rose-500/50 bg-rose-500/10 text-rose-300' },
                      { id: 'info', label: '📢 Announcement (Cyan)', color: 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300' },
                      { id: 'success', label: '🎉 Special Event (Emerald)', color: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300' },
                    ].map(typeItem => (
                      <button
                        key={typeItem.id}
                        type="button"
                        onClick={() => setBroadcastType(typeItem.id as any)}
                        className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all ${broadcastType === typeItem.id ? `${typeItem.color} ring-2 ring-white/20 shadow-lg` : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-neutral-300'}`}
                      >
                        {typeItem.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Alert Marquee Message</label>
                  <textarea
                    rows={2}
                    value={broadcastText}
                    onChange={e => setBroadcastText(e.target.value)}
                    placeholder="e.g. 🚨 Scheduled server maintenance in 15 minutes! Please finish active matches and refrain from placing new stakes."
                    className="w-full bg-black border border-neutral-800 rounded-2xl p-4 text-xs font-mono text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-400 transition-all"
                  />
                </div>

                {broadcastStatusMsg && (
                  <div className={`p-4 rounded-xl border text-xs font-black uppercase tracking-wider text-center ${broadcastStatusMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
                    {broadcastStatusMsg.text}
                  </div>
                )}

                <div className="flex justify-end gap-4 pt-2">
                  <button
                    type="submit"
                    disabled={isPublishingBroadcast || !broadcastText.trim()}
                    className="px-8 py-4 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-cyan-400/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPublishingBroadcast ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    <span>Publish Live Broadcast</span>
                  </button>
                </div>
              </form>
            </section>

            {/* MAINTENANCE MODE MASTER CONTROLLER */}
            <section className={`p-8 md:p-10 rounded-[2.5rem] border transition-all duration-500 shadow-2xl relative overflow-hidden ${maintenanceEnabled ? 'bg-gradient-to-br from-amber-950/40 via-neutral-900 to-black border-amber-500/50 shadow-amber-500/10' : 'bg-gradient-to-br from-neutral-900 via-neutral-900 to-black border-neutral-800 shadow-black'}`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b border-neutral-800/80 pb-8">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border flex items-center gap-1.5 ${maintenanceEnabled ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'}`}>
                      <div className={`w-2 h-2 rounded-full ${maintenanceEnabled ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                      {maintenanceEnabled ? 'MAINTENANCE MODE ACTIVE' : 'ARENA ONLINE & OPERATIONAL'}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
                      SYSTEM LOCK: {maintenanceEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <h4 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">
                    {maintenanceEnabled ? 'Platform is Under Maintenance' : 'All Systems Live & Accessible'}
                  </h4>
                  <p className="text-neutral-400 text-sm max-w-2xl leading-relaxed">
                    {maintenanceEnabled
                      ? 'The public LandingPage shows a maintenance banner and non-admin players cannot create or join matches. Only verified administrators can access and operate the app.'
                      : 'The arena is accessible to all players. Match creation, lobbies, score submissions, and instant automated withdrawals are running normally.'}
                  </p>
                </div>

                <div className="shrink-0 w-full md:w-auto">
                  <button
                    onClick={() => handleToggleMaintenance(!maintenanceEnabled)}
                    disabled={isTogglingMaintenance}
                    className={`w-full md:w-auto px-8 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-3 shadow-2xl active:scale-95 disabled:opacity-50 ${maintenanceEnabled ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950 shadow-emerald-500/20' : 'bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow-amber-400/20'}`}
                  >
                    {isTogglingMaintenance ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : maintenanceEnabled ? (
                      <CheckCircle2 size={18} />
                    ) : (
                      <AlertTriangle size={18} />
                    )}
                    <span>
                      {isTogglingMaintenance
                        ? 'Updating Platform State...'
                        : maintenanceEnabled
                        ? 'Deactivate Maintenance (Go Live)'
                        : 'Enable Maintenance Mode'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Maintenance Rules Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8">
                <div className="p-5 rounded-2xl bg-black/40 border border-neutral-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                    <ShieldAlert size={16} />
                    <span>Match Creation Block</span>
                  </div>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Blocks all non-admin players from publishing 1v1 or 5v5 challenges.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-black/40 border border-neutral-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-black uppercase tracking-wider">
                    <AlertCircle size={16} />
                    <span>Landing Banner</span>
                  </div>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Displays high-visibility maintenance warning banner to all visitors.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-black/40 border border-neutral-800/80 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-wider">
                    <ShieldCheck size={16} />
                    <span>Admin Bypass</span>
                  </div>
                  <p className="text-neutral-400 text-xs leading-relaxed">
                    Users with the Admin role retain full access to manage balances, payouts, and tests.
                  </p>
                </div>
              </div>
            </section>

            {/* SERVER OUTBOUND IP & FLUTTERWAVE WHITELIST HUB */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Server IP Card */}
              <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 md:p-10 shadow-2xl space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tight">Server Outbound IP</h4>
                        <p className="text-xs text-neutral-500 font-medium">Use this IP for payment gateway whitelisting</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono font-bold text-emerald-400 uppercase">
                      VERIFIED
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    This is the static egress IP address from which your server makes automated withdrawal and payout requests to Flutterwave.
                  </p>

                  {/* Primary IP Box */}
                  <div className="p-6 rounded-2xl bg-black/80 border-2 border-amber-400/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-inner">
                    <div className="space-y-1 text-center sm:text-left">
                      <span className="text-[10px] text-amber-400 font-mono font-black uppercase tracking-widest block">
                        PRIMARY EGRESS IPV4
                      </span>
                      <span className="text-2xl md:text-3xl font-mono font-black text-white tracking-wider">
                        {serverIp}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(serverIp);
                        setCopiedIp(true);
                        setTimeout(() => setCopiedIp(false), 2000);
                      }}
                      className="w-full sm:w-auto px-5 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all active:scale-95 shrink-0 shadow-lg shadow-amber-400/10"
                    >
                      {copiedIp ? <Check size={16} className="stroke-[3]" /> : <Copy size={16} />}
                      <span>{copiedIp ? 'Copied to Clipboard!' : 'Copy Server IP'}</span>
                    </button>
                  </div>

                  {/* Alternative Gateway IPs if applicable */}
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] font-mono space-y-1.5 text-neutral-400">
                    <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-sans font-bold">Additional Subnet Egress:</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {['34.34.246.125', '34.34.246.104', '34.34.246.124'].map(ip => (
                        <button
                          key={ip}
                          onClick={() => {
                            navigator.clipboard.writeText(ip);
                            alert(`Copied ${ip}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{ip}</span>
                          <Copy size={11} className="text-neutral-500" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Whitelist quick checklist */}
                <div className="p-5 rounded-2xl bg-black/40 border border-neutral-800/60 space-y-2.5">
                  <div className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <CheckCircle size={15} className="text-amber-400" />
                    <span>Flutterwave Whitelist Instructions</span>
                  </div>
                  <ol className="text-xs text-neutral-400 space-y-1.5 list-decimal list-inside leading-relaxed">
                    <li>Log into your <b>Flutterwave Dashboard</b></li>
                    <li>Go to <b>Settings</b> → <b>API Keys & Webhooks</b> (or <b>IP Whitelist</b>)</li>
                    <li>Add IP: <code className="text-amber-400 font-mono font-bold bg-neutral-900 px-1.5 py-0.5 rounded">34.34.246.125</code></li>
                    <li>Save settings. Live automated withdrawals will execute instantly.</li>
                  </ol>
                </div>
              </section>

              {/* Live Flutterwave Diagnostics Card */}
              <section className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-8 md:p-10 shadow-2xl space-y-6 flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                        <Wallet size={20} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-white uppercase tracking-tight">Payout Gateway Diagnostics</h4>
                        <p className="text-xs text-neutral-500 font-medium">Verify Flutterwave API connectivity and IP status</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-mono font-bold text-amber-400 uppercase">
                      FLUTTERWAVE
                    </span>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Run an instant live payout check to verify that Flutterwave accepts the server's whitelisted IP address and credentials.
                  </p>

                  <div className="p-5 rounded-2xl bg-black/60 border border-neutral-800 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-mono">Test Account:</span>
                      <span className="text-white font-mono font-bold">9151609682 (OPay)</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-mono">Account Name:</span>
                      <span className="text-white font-mono font-bold">NURUDEEN BOLAJI ABDULSALAM</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-mono">Test Payout Amount:</span>
                      <span className="text-emerald-400 font-mono font-bold">₦100</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500 font-mono">Active Gateway:</span>
                      <span className="text-amber-400 font-mono font-bold">Flutterwave Instant Payout</span>
                    </div>
                  </div>

                  <button
                    onClick={handleRunFlwTest}
                    disabled={flwTestLoading}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-neutral-950 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl shadow-amber-400/20 active:scale-95 disabled:opacity-50"
                  >
                    {flwTestLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Zap size={16} />
                    )}
                    <span>{flwTestLoading ? 'Executing Diagnostic Payout...' : 'Run Test Payout (₦100 to OPay)'}</span>
                  </button>

                  {/* Test Result Display */}
                  {flwTestResult && (
                    <div className={`p-4 rounded-xl border text-xs font-mono space-y-2 ${flwTestResult.success ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/40 border-rose-500/40 text-rose-300'}`}>
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5">
                          {flwTestResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                          <span>{flwTestResult.success ? 'TEST DISPATCHED SUCCESSFULLY' : 'DIAGNOSTIC TEST FAILED'}</span>
                        </span>
                        {flwTestResult.transferId && (
                          <span className="text-[10px] text-neutral-400">ID: {flwTestResult.transferId}</span>
                        )}
                      </div>
                      <p className="text-[11px] leading-relaxed break-all">
                        {flwTestResult.message || flwTestResult.error || JSON.stringify(flwTestResult)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Policy Notice */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-500 space-y-1">
                  <div className="font-bold text-neutral-400 flex items-center gap-1.5">
                    <Lock size={12} />
                    <span>Security & Anti-Exploit Enforcement</span>
                  </div>
                  <p>
                    Normal public withdrawal threshold is locked at <b>₦5,000</b>. Paystack withdrawal gateway has been decommissioned. Only Flutterwave Instant Automated Payout is active.
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {balanceModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <form onSubmit={handleAdjustBalanceSubmit} className="bg-neutral-900 border border-neutral-800 rounded-[3rem] w-full max-w-xl p-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] space-y-8 animate-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center border-b border-neutral-800/50 pb-8">
              <div className="space-y-1">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Adjust Ledger</h3>
                <p className="text-neutral-500 text-xs font-medium uppercase tracking-widest opacity-60">Manual Balance Override</p>
              </div>
              <button type="button" onClick={() => setBalanceModal({ ...balanceModal, isOpen: false })} className="p-3 bg-neutral-800 rounded-[1.25rem] text-neutral-500 hover:text-white transition-all active:scale-90"><X /></button>
            </div>
            
            <div className="flex items-center gap-6 p-6 bg-black/60 rounded-[2rem] border border-neutral-800/50 shadow-inner">
               <div className="w-16 h-16 rounded-2xl bg-amber-400 flex items-center justify-center text-black font-black text-2xl shadow-xl shadow-amber-400/10">
                 {balanceModal.user?.codmIgn?.slice(0, 1).toUpperCase()}
               </div>
               <div>
                 <p className="text-lg font-black text-white uppercase tracking-tight leading-none">{balanceModal.user?.codmIgn}</p>
                 <p className="text-[11px] text-neutral-500 font-mono font-bold mt-2 uppercase tracking-widest">CURRENT SECTOR FUNDS: <span className="text-emerald-500">₦{balanceModal.user?.balance.toLocaleString()}</span></p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               {(['credit', 'debit'] as const).map(t => (
                 <button key={t} type="button" onClick={() => setBalanceModal({ ...balanceModal, type: t })} className={`py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] border-2 transition-all duration-300 flex items-center justify-center gap-3 ${balanceModal.type === t ? 'bg-amber-400 text-black border-amber-400 shadow-xl shadow-amber-400/20' : 'bg-black border-neutral-800 text-neutral-600 hover:border-neutral-700'}`}>
                   {t === 'credit' ? <PlusCircle size={20} /> : <MinusCircle size={20} />}
                   {t} Account
                 </button>
               ))}
            </div>

            <div className="space-y-6">
              <div className="relative group">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600 font-black text-2xl group-focus-within:text-amber-400 transition-colors pointer-events-none">₦</span>
                <input type="number" step="any" value={balanceModal.amount} onChange={e => setBalanceModal({ ...balanceModal, amount: e.target.value })} placeholder="0.00" className="w-full bg-black border border-neutral-800 rounded-[1.5rem] pl-16 pr-8 py-6 text-3xl font-mono font-black text-white focus:border-amber-400 focus:outline-none transition-all" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4 opacity-60">Authentication Reason</label>
                <input type="text" value={balanceModal.reason} onChange={e => setBalanceModal({ ...balanceModal, reason: e.target.value })} placeholder="e.g. MANUAL_DEPOSIT_SYNC_REF://8823..." className="w-full bg-black border border-neutral-800 rounded-[1.5rem] px-8 py-5 text-sm font-bold text-white focus:border-amber-400 focus:outline-none placeholder:text-neutral-800" />
              </div>
            </div>

            {balanceModal.error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-black uppercase tracking-widest text-center rounded-2xl">{balanceModal.error}</div>}

            <button type="submit" disabled={balanceModal.isSubmitting} className="w-full py-6 bg-amber-400 text-black font-black uppercase tracking-[0.3em] rounded-[2rem] hover:bg-amber-300 transition-all active:scale-[0.98] shadow-2xl shadow-amber-400/20 disabled:opacity-30 flex items-center justify-center gap-3">
              {balanceModal.isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <ShieldCheck size={24} />}
              Commit Ledger Change
            </button>
          </form>
        </div>
      )}

      {connectModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
           <form onSubmit={handleConnectGmailSubmit} className="bg-neutral-900 border border-neutral-800 rounded-[3rem] w-full max-w-xl p-10 shadow-[0_0_100px_rgba(0,0,0,0.5)] space-y-8 animate-in zoom-in-95 duration-500">
              <div className="flex justify-between items-center border-b border-neutral-800/50 pb-8">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Sync Terminal</h3>
                  <p className="text-neutral-500 text-xs font-medium uppercase tracking-widest opacity-60">Gmail IMAP Configuration</p>
                </div>
                <button type="button" onClick={() => setConnectModalOpen(false)} className="p-3 bg-neutral-800 rounded-[1.25rem] text-neutral-500 hover:text-white transition-all active:scale-90"><X /></button>
              </div>

              <div className="p-6 bg-emerald-500/5 border border-emerald-500/10 rounded-[2rem] space-y-3 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none rotate-12"><Key size={80} className="text-emerald-400" /></div>
                 <p className="text-[10px] text-emerald-400 font-black uppercase tracking-[0.2em] relative z-10">Security Protocol Required</p>
                 <p className="text-[12px] text-neutral-400 leading-relaxed relative z-10 font-medium">Enable 2-Step Auth and generate a 16-character <strong className="text-white">App Password</strong> from your Google Security Settings. Do not use your standard password.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4 opacity-60">Gmail Address</label>
                  <div className="relative group">
                    <Mail size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-amber-400 transition-colors" />
                    <input type="email" value={gmailForm.address} onChange={e => setGmailForm({ ...gmailForm, address: e.target.value })} placeholder="admin@gmail.com" className="w-full bg-black border border-neutral-800 rounded-[1.5rem] pl-16 pr-8 py-5 text-[15px] font-bold text-white focus:border-amber-400 focus:outline-none transition-all placeholder:text-neutral-800" required />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center px-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest opacity-60">App Password</label>
                    <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-400 hover:underline font-black uppercase tracking-widest flex items-center gap-1.5">Link Terminal <ExternalLink size={10} /></a>
                  </div>
                  <div className="relative group">
                    <Key size={20} className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-amber-400 transition-colors" />
                    <input type="password" value={gmailForm.password} onChange={e => setGmailForm({ ...gmailForm, password: e.target.value })} placeholder="•••• •••• •••• ••••" className="w-full bg-black border border-neutral-800 rounded-[1.5rem] pl-16 pr-8 py-5 text-[15px] font-mono font-bold text-white focus:border-amber-400 focus:outline-none transition-all placeholder:text-neutral-800" required />
                  </div>
                </div>

                <div className="flex items-center gap-4 px-4 py-2">
                   <div className="flex items-center h-6">
                     <input id="autosync-check" type="checkbox" checked={gmailForm.autoSync} onChange={e => setGmailForm({ ...gmailForm, autoSync: e.target.checked })} className="w-5 h-5 rounded-lg border-neutral-800 bg-black text-amber-400 focus:ring-amber-400 focus:ring-offset-neutral-900 transition-all cursor-pointer" />
                   </div>
                   <label htmlFor="autosync-check" className="text-[11px] text-neutral-400 font-black uppercase tracking-widest cursor-pointer group hover:text-white transition-colors">Enable Background Polling (3m Intervals)</label>
                </div>
              </div>

              {gmailForm.error && <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[11px] font-black uppercase tracking-widest text-center rounded-2xl">{gmailForm.error}</div>}
              {gmailForm.success && <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[11px] font-black uppercase tracking-widest text-center rounded-2xl">{gmailForm.success}</div>}

              <button type="submit" disabled={gmailForm.isSubmitting} className="w-full py-6 bg-amber-400 text-black font-black uppercase tracking-[0.3em] rounded-[2rem] hover:bg-amber-300 transition-all active:scale-[0.98] shadow-2xl shadow-amber-400/20 disabled:opacity-30 flex items-center justify-center gap-3">
                {gmailForm.isSubmitting ? <Loader2 size={24} className="animate-spin" /> : <Zap size={24} />}
                Establish Connection
              </button>
           </form>
        </div>
      )}

      {selectedDispute && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-neutral-900 border border-neutral-800 rounded-[3rem] w-full max-w-6xl max-h-[90vh] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="p-8 border-b border-neutral-800 bg-neutral-950/50 flex justify-between items-center">
                 <div className="flex items-center gap-6">
                    <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center text-black shadow-xl shadow-amber-400/10">
                      <Shield size={28} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-none">Forensic Review Hub</h3>
                      <p className="text-neutral-500 text-xs font-medium uppercase tracking-widest mt-1 opacity-60">Match Sector: #{selectedDispute.challengeCode} · Pot: ₦{selectedDispute.potAmount.toLocaleString()}</p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedDispute(null)} className="p-3 bg-neutral-800 rounded-[1.25rem] text-neutral-500 hover:text-white transition-all active:scale-90"><X /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* CREATOR SECTION */}
                    <div className="space-y-6">
                       <div className="flex items-center justify-between px-4">
                          <div className="flex items-center gap-3">
                             <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(selectedDispute.creator.codmIgn)}`} className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700" alt="" />
                             <div>
                               <p className="text-sm font-black text-white uppercase tracking-tight">{selectedDispute.creator.codmIgn}</p>
                               <p className="text-[10px] text-neutral-500 font-mono">CLAIM: {selectedDispute.creator.resultClaim || 'NONE'}</p>
                             </div>
                          </div>
                          {selectedDispute.creator.screenshotUrl && (
                             <button 
                               onClick={async () => {
                                 setIsAnalyzing('creator');
                                 try {
                                   const result = await analyzeScreenshotForensic({
                                     adminUserId: currentUser.id,
                                     screenshotBase64: selectedDispute.creator.screenshotUrl!,
                                     playerIgn: selectedDispute.creator.codmIgn,
                                     matchId: selectedDispute.id
                                   });
                                   const updatedDispute = { ...selectedDispute };
                                   updatedDispute.creator.forensicAnalysis = { 
                                      ...result.analysis,
                                      fileInfo: result.fileInfo 
                                   };
                                   setSelectedDispute(updatedDispute);
                                 } catch (e: any) { alert(e.message); } finally { setIsAnalyzing(null); }
                               }}
                               disabled={!!isAnalyzing}
                               className="px-4 py-2 bg-neutral-800 hover:bg-amber-400/10 text-amber-400 border border-neutral-700 hover:border-amber-400/40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                             >
                               {isAnalyzing === 'creator' ? <Loader2 size={12} className="animate-spin" /> : 'Deep Analysis'}
                             </button>
                          )}
                       </div>

                       <div className="aspect-video bg-black rounded-[2rem] border border-neutral-800 overflow-hidden relative group">
                          {selectedDispute.creator.screenshotUrl ? (
                             <img src={selectedDispute.creator.screenshotUrl} className="w-full h-full object-contain" alt="Creator Proof" />
                          ) : (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-700 space-y-3">
                                <Camera size={48} className="opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No Proof Uploaded</p>
                             </div>
                          )}
                          <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-black text-white uppercase tracking-widest border border-white/10">HOST SECTOR</div>
                       </div>

                       {selectedDispute.creator.forensicAnalysis && (
                          <div className="p-6 bg-black/40 rounded-[2rem] border border-neutral-800 space-y-4 animate-in slide-in-from-top-4">
                             <div className="flex justify-between items-center border-b border-neutral-800/50 pb-3">
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">Forensic Signal Result</p>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black border tracking-widest ${selectedDispute.creator.forensicAnalysis.isLikelyFake ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                  {selectedDispute.creator.forensicAnalysis.isLikelyFake ? 'SUSPICIOUS' : 'TRUSTED'}
                                </span>
                             </div>
                             <div className="space-y-3">
                                <div className="p-3 bg-neutral-900/50 rounded-xl border border-neutral-800 space-y-1">
                                   <p className="text-[8px] text-neutral-600 font-black uppercase tracking-widest">Metadata / Header</p>
                                   <p className="text-[10px] font-mono text-neutral-400 truncate">{selectedDispute.creator.forensicAnalysis.fileInfo?.mimeType || 'IMAGE/BASE64'} · {selectedDispute.creator.forensicAnalysis.fileInfo?.headerHex?.substring(0, 16) || 'N/A'}...</p>
                                   {selectedDispute.creator.forensicAnalysis.fileInfo?.isStandardType === false && <p className="text-[9px] text-rose-400 font-bold uppercase mt-1">⚠️ Non-Standard File Signature</p>}
                                </div>
                                <p className="text-[11px] text-white font-bold leading-relaxed italic">"{selectedDispute.creator.forensicAnalysis.verdict}"</p>
                                <div className="grid grid-cols-2 gap-3 text-[9px] font-mono">
                                   <div className="p-2 bg-neutral-900 rounded-lg"><span className="text-neutral-600 uppercase block mb-1">AI Detection</span><span className={selectedDispute.creator.forensicAnalysis.aiDetected ? 'text-rose-400' : 'text-emerald-400'}>{selectedDispute.creator.forensicAnalysis.aiDetected ? 'POSITIVE' : 'NEGATIVE'}</span></div>
                                   <div className="p-2 bg-neutral-900 rounded-lg"><span className="text-neutral-600 uppercase block mb-1">Manipulation</span><span className={selectedDispute.creator.forensicAnalysis.manipulationDetected ? 'text-rose-400' : 'text-emerald-400'}>{selectedDispute.creator.forensicAnalysis.manipulationDetected ? 'DETECTED' : 'NOT FOUND'}</span></div>
                                </div>
                                <div className="space-y-1">
                                   <p className="text-[9px] text-neutral-600 uppercase font-black tracking-widest">Detected Red Flags:</p>
                                   <div className="flex flex-wrap gap-2">
                                      {selectedDispute.creator.forensicAnalysis.redFlags.map((flag, idx) => (
                                         <span key={idx} className="px-2 py-0.5 bg-rose-500/5 border border-rose-500/10 text-rose-400 text-[8px] rounded uppercase font-bold">{flag}</span>
                                      ))}
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>

                    {/* OPPONENT SECTION */}
                    <div className="space-y-6">
                       <div className="flex items-center justify-between px-4">
                          <div className="flex items-center gap-3">
                             <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(selectedDispute.opponent?.codmIgn || 'player')}`} className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700" alt="" />
                             <div>
                               <p className="text-sm font-black text-white uppercase tracking-tight">{selectedDispute.opponent?.codmIgn || 'Awaiting Opponent'}</p>
                               <p className="text-[10px] text-neutral-500 font-mono">CLAIM: {selectedDispute.opponent?.resultClaim || 'NONE'}</p>
                             </div>
                          </div>
                          {selectedDispute.opponent?.screenshotUrl && (
                             <button 
                               onClick={async () => {
                                 setIsAnalyzing('opponent');
                                 try {
                                   const result = await analyzeScreenshotForensic({
                                     adminUserId: currentUser.id,
                                     screenshotBase64: selectedDispute.opponent!.screenshotUrl!,
                                     playerIgn: selectedDispute.opponent!.codmIgn,
                                     matchId: selectedDispute.id
                                   });
                                   const updatedDispute = { ...selectedDispute };
                                   if (updatedDispute.opponent) {
                                      updatedDispute.opponent.forensicAnalysis = { 
                                         ...result.analysis,
                                         fileInfo: result.fileInfo 
                                      };
                                   }
                                   setSelectedDispute(updatedDispute);
                                 } catch (e: any) { alert(e.message); } finally { setIsAnalyzing(null); }
                               }}
                               disabled={!!isAnalyzing}
                               className="px-4 py-2 bg-neutral-800 hover:bg-amber-400/10 text-amber-400 border border-neutral-700 hover:border-amber-400/40 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                             >
                               {isAnalyzing === 'opponent' ? <Loader2 size={12} className="animate-spin" /> : 'Deep Analysis'}
                             </button>
                          )}
                       </div>

                       <div className="aspect-video bg-black rounded-[2rem] border border-neutral-800 overflow-hidden relative group">
                          {selectedDispute.opponent?.screenshotUrl ? (
                             <img src={selectedDispute.opponent.screenshotUrl} className="w-full h-full object-contain" alt="Opponent Proof" />
                          ) : (
                             <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-700 space-y-3">
                                <Camera size={48} className="opacity-20" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No Proof Uploaded</p>
                             </div>
                          )}
                          <div className="absolute top-4 left-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[9px] font-black text-white uppercase tracking-widest border border-white/10">RIVAL SECTOR</div>
                       </div>

                       {selectedDispute.opponent?.forensicAnalysis && (
                          <div className="p-6 bg-black/40 rounded-[2rem] border border-neutral-800 space-y-4 animate-in slide-in-from-top-4">
                             <div className="flex justify-between items-center border-b border-neutral-800/50 pb-3">
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.2em]">Forensic Signal Result</p>
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black border tracking-widest ${selectedDispute.opponent.forensicAnalysis.isLikelyFake ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                                  {selectedDispute.opponent.forensicAnalysis.isLikelyFake ? 'SUSPICIOUS' : 'TRUSTED'}
                                </span>
                             </div>
                             <div className="space-y-3">
                                <div className="p-3 bg-neutral-900/50 rounded-xl border border-neutral-800 space-y-1">
                                   <p className="text-[8px] text-neutral-600 font-black uppercase tracking-widest">Metadata / Header</p>
                                   <p className="text-[10px] font-mono text-neutral-400 truncate">{selectedDispute.opponent.forensicAnalysis.fileInfo?.mimeType || 'IMAGE/BASE64'} · {selectedDispute.opponent.forensicAnalysis.fileInfo?.headerHex?.substring(0, 16) || 'N/A'}...</p>
                                   {selectedDispute.opponent.forensicAnalysis.fileInfo?.isStandardType === false && <p className="text-[9px] text-rose-400 font-bold uppercase mt-1">⚠️ Non-Standard File Signature</p>}
                                </div>
                                <p className="text-[11px] text-white font-bold leading-relaxed italic">"{selectedDispute.opponent.forensicAnalysis.verdict}"</p>
                                <div className="grid grid-cols-2 gap-3 text-[9px] font-mono">
                                   <div className="p-2 bg-neutral-900 rounded-lg"><span className="text-neutral-600 uppercase block mb-1">AI Detection</span><span className={selectedDispute.opponent.forensicAnalysis.aiDetected ? 'text-rose-400' : 'text-emerald-400'}>{selectedDispute.opponent.forensicAnalysis.aiDetected ? 'POSITIVE' : 'NEGATIVE'}</span></div>
                                   <div className="p-2 bg-neutral-900 rounded-lg"><span className="text-neutral-600 uppercase block mb-1">Manipulation</span><span className={selectedDispute.opponent.forensicAnalysis.manipulationDetected ? 'text-rose-400' : 'text-emerald-400'}>{selectedDispute.opponent.forensicAnalysis.manipulationDetected ? 'DETECTED' : 'NOT FOUND'}</span></div>
                                </div>
                                <div className="space-y-1">
                                   <p className="text-[9px] text-neutral-600 uppercase font-black tracking-widest">Detected Red Flags:</p>
                                   <div className="flex flex-wrap gap-2">
                                      {selectedDispute.opponent.forensicAnalysis.redFlags.map((flag, idx) => (
                                         <span key={idx} className="px-2 py-0.5 bg-rose-500/5 border border-rose-500/10 text-rose-400 text-[8px] rounded uppercase font-bold">{flag}</span>
                                      ))}
                                   </div>
                                </div>
                             </div>
                          </div>
                       )}
                    </div>
                 </div>
              </div>

              <div className="p-8 border-t border-neutral-800 bg-neutral-950/50 space-y-6">
                 <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                    <div className="space-y-1">
                       <h4 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em]">Manual Resolution Protocol</h4>
                       <p className="text-xs text-neutral-400 font-medium">Overriding automated referee. Selecting a winner will instantly settle the escrow pot.</p>
                    </div>
                    <div className="flex items-center gap-3">
                       <button 
                         onClick={async () => { if(confirm(`Award victory and ₦${selectedDispute.winnerPayout.toLocaleString()} to ${selectedDispute.creator.codmIgn}?`)) { await adminResolveMatch(selectedDispute.id, currentUser.id, selectedDispute.creator.id); setSelectedDispute(null); loadDisputes(); } }}
                         className="px-6 py-4 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-400 transition-all active:scale-95"
                       >
                         Victory to Host
                       </button>
                       <button 
                         onClick={async () => { if(selectedDispute.opponent && confirm(`Award victory and ₦${selectedDispute.winnerPayout.toLocaleString()} to ${selectedDispute.opponent.codmIgn}?`)) { await adminResolveMatch(selectedDispute.id, currentUser.id, selectedDispute.opponent.id); setSelectedDispute(null); loadDisputes(); } }}
                         disabled={!selectedDispute.opponent}
                         className="px-6 py-4 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-30"
                       >
                         Victory to Rival
                       </button>
                       <button 
                         onClick={async () => { if(confirm('Refund full stakes to both players? Platform fees will not be collected.')) { await adminAbandonMatch(selectedDispute.id, currentUser.id, 'Dispute resolved as draw/refund'); setSelectedDispute(null); loadDisputes(); } }}
                         className="px-6 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl border border-neutral-700 transition-all active:scale-95"
                       >
                         Full Refund
                       </button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* 1. APPROVE PAYOUT MODAL */}
      {payoutModal.isOpen && payoutModal.match && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <form onSubmit={handleApprovePayoutSubmit} className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle size={20} className="text-emerald-400" />
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Approve Payout</h3>
                </div>
                <p className="text-neutral-500 text-xs font-mono">
                  MATCH #{payoutModal.match.challengeCode} · POT: ₦{payoutModal.match.potAmount.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayoutModal({ isOpen: false, match: null, selectedWinnerId: '', isSubmitting: false, error: null })}
                className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Select Victor to Receive Escrow Payout (₦{payoutModal.match.winnerPayout.toLocaleString()}):
              </label>

              {/* Option A: Host */}
              <div
                onClick={() => setPayoutModal(prev => ({ ...prev, selectedWinnerId: payoutModal.match!.creator.id }))}
                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  payoutModal.selectedWinnerId === payoutModal.match.creator.id
                    ? 'border-emerald-500/80 bg-emerald-500/10 text-white'
                    : 'border-neutral-800 bg-black/50 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(payoutModal.match.creator.codmIgn)}`} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 object-cover" />
                  <div>
                    <div className="font-bold text-xs text-white">{payoutModal.match.creator.codmIgn} (Host)</div>
                    <div className="text-[10px] text-neutral-500 font-mono">Claimed: {payoutModal.match.creator.resultClaim || 'None'}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-emerald-400 font-mono">₦{payoutModal.match.winnerPayout.toLocaleString()}</div>
                  <div className="text-[9px] text-neutral-500 font-bold uppercase">Award Victory</div>
                </div>
              </div>

              {/* Option B: Rival */}
              {payoutModal.match.opponent && (
                <div
                  onClick={() => setPayoutModal(prev => ({ ...prev, selectedWinnerId: payoutModal.match!.opponent!.id }))}
                  className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    payoutModal.selectedWinnerId === payoutModal.match.opponent.id
                      ? 'border-emerald-500/80 bg-emerald-500/10 text-white'
                      : 'border-neutral-800 bg-black/50 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(payoutModal.match.opponent.codmIgn)}`} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 object-cover" />
                    <div>
                      <div className="font-bold text-xs text-white">{payoutModal.match.opponent.codmIgn} (Rival)</div>
                      <div className="text-[10px] text-neutral-500 font-mono">Claimed: {payoutModal.match.opponent.resultClaim || 'None'}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-emerald-400 font-mono">₦{payoutModal.match.winnerPayout.toLocaleString()}</div>
                    <div className="text-[9px] text-neutral-500 font-bold uppercase">Award Victory</div>
                  </div>
                </div>
              )}

              {/* Option C: Mutual Draw / Refund */}
              <div
                onClick={() => setPayoutModal(prev => ({ ...prev, selectedWinnerId: 'REFUND' }))}
                className={`p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                  payoutModal.selectedWinnerId === 'REFUND'
                    ? 'border-amber-400/80 bg-amber-400/10 text-white'
                    : 'border-neutral-800 bg-black/50 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-amber-300">Mutual Draw / Full Stake Refund</div>
                  <div className="text-[10px] text-neutral-500 font-medium">Return ₦{payoutModal.match.stakeAmount.toLocaleString()} to each gladiator's balance</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-black text-amber-400 font-mono">₦{payoutModal.match.stakeAmount.toLocaleString()} ea</div>
                  <div className="text-[9px] text-neutral-500 font-bold uppercase">Refund</div>
                </div>
              </div>
            </div>

            {payoutModal.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl text-center">
                {payoutModal.error}
              </div>
            )}

            <button
              type="submit"
              disabled={payoutModal.isSubmitting || !payoutModal.selectedWinnerId}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black uppercase tracking-wider rounded-2xl text-xs transition-all shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {payoutModal.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
              <span>Commit Payout & Release Escrow</span>
            </button>
          </form>
        </div>
      )}

      {/* 2. REJECT & REQUEST RESUBMISSION MODAL */}
      {resubmitModal.isOpen && resubmitModal.match && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <form onSubmit={handleResubmitSubmit} className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <RotateCcw size={20} className="text-amber-400" />
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Request Resubmission</h3>
                </div>
                <p className="text-neutral-500 text-xs font-mono">
                  MATCH #{resubmitModal.match.challengeCode} · REJECT FAKE/UNCLEAR PROOF
                </p>
              </div>
              <button
                type="button"
                onClick={() => setResubmitModal({ isOpen: false, match: null, targetPlayerId: 'both', reason: '', isSubmitting: false, error: null })}
                className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Target Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Target Player Required to Re-upload Proof:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'both', label: 'Both Players' },
                  { id: resubmitModal.match.creator.id, label: `Host (${resubmitModal.match.creator.codmIgn})` },
                  ...(resubmitModal.match.opponent ? [{ id: resubmitModal.match.opponent.id, label: `Rival (${resubmitModal.match.opponent.codmIgn})` }] : [])
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setResubmitModal(prev => ({ ...prev, targetPlayerId: opt.id }))}
                    className={`py-2 px-3 rounded-xl text-[11px] font-bold border transition-all text-center cursor-pointer ${
                      resubmitModal.targetPlayerId === opt.id
                        ? 'bg-amber-400 text-neutral-950 border-amber-400 font-black'
                        : 'bg-black/50 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Quick Reason Presets:
              </label>
              <div className="space-y-1.5">
                {[
                  'AI-generated or synthetic image detected (1:1 aspect ratio or generator metadata). Please upload genuine in-game screenshot.',
                  'Scoreboard is cropped / Victory banner not fully visible. Please upload full landscape screenshot.',
                  'Screenshot is low resolution or blurry; player IGN and score cannot be verified.',
                  'Wrong match room number or conflicting in-game opponent IGN shown.'
                ].map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setResubmitModal(prev => ({ ...prev, reason: preset }))}
                    className="w-full p-2.5 rounded-lg bg-black/40 hover:bg-neutral-800 border border-neutral-800/80 text-left text-[11px] text-neutral-300 hover:text-white transition-all cursor-pointer"
                  >
                    "{preset}"
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Reason Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Custom Notice & Instructions:
              </label>
              <textarea
                value={resubmitModal.reason}
                onChange={e => setResubmitModal(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
                placeholder="Explain why the proof was rejected and what gladiator must upload..."
                className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400 font-sans resize-none"
                required
              />
            </div>

            {resubmitModal.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl text-center">
                {resubmitModal.error}
              </div>
            )}

            <button
              type="submit"
              disabled={resubmitModal.isSubmitting || !resubmitModal.reason.trim()}
              className="w-full py-4 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black uppercase tracking-wider rounded-2xl text-xs transition-all shadow-xl shadow-amber-400/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {resubmitModal.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
              <span>Reject Proof & Send Resubmission Notice</span>
            </button>
          </form>
        </div>
      )}

      {/* 3. ESCALATE TO MANUAL REVIEW MODAL */}
      {escalateModal.isOpen && escalateModal.match && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
          <form onSubmit={handleEscalateSubmit} className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] w-full max-w-lg p-8 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Shield size={20} className="text-rose-400" />
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Escalate to Manual Review</h3>
                </div>
                <p className="text-neutral-500 text-xs font-mono">
                  MATCH #{escalateModal.match.challengeCode} · FREEZE POT: ₦{escalateModal.match.potAmount.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEscalateModal({ isOpen: false, match: null, reason: '', isSubmitting: false, error: null })}
                className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 text-rose-300 text-xs space-y-2">
              <div className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-2">
                <AlertTriangle size={14} />
                <span>Security Protocol Warning</span>
              </div>
              <p className="text-neutral-300 text-xs leading-relaxed">
                Escalating this match will freeze the ₦{escalateModal.match.potAmount.toLocaleString()} pot in escrow, mark the status as <strong>DISPUTED</strong>, and notify both players via in-game room chat.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider block">
                Audit Reason / Forensic Discrepancy:
              </label>
              <textarea
                value={escalateModal.reason}
                onChange={e => setEscalateModal(prev => ({ ...prev, reason: e.target.value }))}
                rows={3}
                placeholder="Reason for manual referee escalation..."
                className="w-full bg-black border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-rose-400 font-sans resize-none"
                required
              />
            </div>

            {escalateModal.error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs rounded-xl text-center">
                {escalateModal.error}
              </div>
            )}

            <button
              type="submit"
              disabled={escalateModal.isSubmitting || !escalateModal.reason.trim()}
              className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-wider rounded-2xl text-xs transition-all shadow-xl shadow-rose-600/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {escalateModal.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
              <span>Lock Escrow & Mark Disputed</span>
            </button>
          </form>
        </div>
      )}

      {/* 4. LIGHTBOX ZOOM & INSPECTION MODAL */}
      {lightboxData && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-neutral-800 rounded-[2.5rem] w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-neutral-800 bg-neutral-950 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">{lightboxData.role} PROOF</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-sm font-black text-white">{lightboxData.playerIgn}</span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-xs font-mono text-neutral-400">Match #{lightboxData.matchCode}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLightboxData(null)}
                className="p-2.5 bg-neutral-800 hover:bg-neutral-700 rounded-xl text-neutral-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-black p-4 flex items-center justify-center">
              {lightboxData.url.startsWith('data:video/') ? (
                <video 
                  src={lightboxData.url} 
                  className="max-w-full max-h-[70vh] rounded-lg border border-neutral-800 shadow-2xl" 
                  controls 
                  autoPlay
                />
              ) : (
                <img
                  src={lightboxData.url}
                  alt={`${lightboxData.playerIgn} proof`}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg border border-neutral-800 shadow-2xl"
                />
              )}
            </div>

            {lightboxData.systemAi && (
              <div className="p-5 border-t border-neutral-800 bg-neutral-950/80 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded font-bold uppercase text-[10px] border ${
                    lightboxData.systemAi.isLikelyFake
                      ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  }`}>
                    {lightboxData.systemAi.verdict} ({Math.round(lightboxData.systemAi.confidenceScore * 100)}%)
                  </span>
                  <span className="text-neutral-400">Aspect Ratio: <strong className="text-white">{lightboxData.systemAi.aspectRatio}</strong></span>
                  <span className="text-neutral-400">Format: <strong className="text-white">{lightboxData.systemAi.fileType.toUpperCase().replace('IMAGE/', '')}</strong></span>
                </div>
                {lightboxData.systemAi.redFlags.length > 0 && (
                  <div className="text-rose-400 text-[11px] font-sans">
                    Flags: {lightboxData.systemAi.redFlags.join(' · ')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {emailViewerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="bg-neutral-900 border border-neutral-800 rounded-[3rem] w-full max-w-3xl max-h-[85vh] flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.5)] overflow-hidden animate-in zoom-in-95 duration-500">
              <div className="p-10 border-b border-neutral-800 bg-neutral-950/50 flex flex-col sm:flex-row justify-between items-start gap-6">
                 <div className="space-y-4 min-w-0 flex-1">
                   <div className="flex flex-wrap items-center gap-2">
                     <span className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] bg-amber-400 text-black rounded-lg shadow-lg shadow-amber-400/10">SYNC_LOG</span>
                     <span className="text-[10px] text-neutral-600 font-mono font-bold">NODE_ID://{emailViewerModal.id.slice(-12)}</span>
                   </div>
                   <h3 className="text-2xl font-black text-white uppercase tracking-tighter leading-[1.1]">{emailViewerModal.subject}</h3>
                   <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500 font-bold text-[10px] border border-neutral-700/50">{emailViewerModal.senderName?.slice(0, 1).toUpperCase() || 'M'}</div>
                        <span className="text-[11px] font-black text-neutral-300 uppercase tracking-widest">{emailViewerModal.senderName || 'Unknown Agent'}</span>
                      </div>
                      <div className="text-[10px] text-neutral-600 font-mono font-bold tracking-tighter">&lt;{emailViewerModal.senderEmail}&gt;</div>
                   </div>
                 </div>
                 <button onClick={() => setEmailViewerModal(null)} className="p-3 bg-neutral-800 rounded-[1.25rem] text-neutral-500 hover:text-white transition-all active:scale-90 shrink-0"><X /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-10 bg-neutral-900 text-neutral-400 text-[14px] leading-relaxed whitespace-pre-wrap font-sans selection:bg-amber-400 selection:text-black">
                 {emailViewerModal.body}
              </div>
              <div className="p-8 border-t border-neutral-800 bg-neutral-950/50 flex flex-col sm:flex-row items-center justify-between gap-6">
                 <div className="flex items-center gap-3 text-[10px] text-neutral-500 font-black uppercase tracking-widest">
                   <Clock className="w-4 h-4 text-neutral-700" />
                   TIMESTAMP: {new Date(emailViewerModal.createdAt).toLocaleString()}
                 </div>
                 <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button onClick={() => setEmailViewerModal(null)} className="flex-1 sm:flex-none px-10 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all">Close</button>
                    <button onClick={async () => { if(confirm('Erase this sector log entry?')) { await deleteAdminEmail(currentUser.id, emailViewerModal.id); setEmailsList(prev => prev.filter(m => m.id !== emailViewerModal.id)); setEmailViewerModal(null); } }} className="flex-1 sm:flex-none px-10 py-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black rounded-2xl text-[10px] uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center justify-center gap-2.5">
                      <Trash2 size={16} />
                      Purge
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {grantModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="bg-neutral-900 border border-neutral-800 rounded-[3rem] w-full max-w-lg p-10 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-300 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Grant Privileges</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Elevate user clearance level</p>
                </div>
              </div>
              <button onClick={() => setGrantModal({ ...grantModal, isOpen: false })} className="p-3 bg-neutral-800 rounded-2xl text-neutral-400 hover:text-white transition-all"><X size={18} /></button>
            </div>

            {grantModal.error && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-3">
                <AlertCircle size={16} className="shrink-0" />
                {grantModal.error}
              </div>
            )}

            {grantModal.message && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-xs font-bold flex items-center gap-3">
                <CheckCircle2 size={16} className="shrink-0" />
                {grantModal.message}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-2">User Email, IGN or ID</label>
                <input
                  type="text"
                  value={grantModal.identifier}
                  onChange={e => setGrantModal({ ...grantModal, identifier: e.target.value })}
                  placeholder="e.g. user@gmail.com or CODM_Gamer"
                  className="w-full bg-black border border-neutral-800 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:border-amber-400 focus:outline-none focus:ring-4 focus:ring-amber-400/5 placeholder:text-neutral-700"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400 mb-2">Select Permission Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {(["user", "moderator", "admin"] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setGrantModal({ ...grantModal, role: r })}
                      className={`py-4 rounded-2xl text-xs font-black uppercase tracking-widest border transition-all ${
                        grantModal.role === r
                          ? r === "admin" ? "bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-lg shadow-rose-500/10" : r === "moderator" ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-lg shadow-amber-500/10" : "bg-blue-500/20 border-blue-500/50 text-blue-400"
                          : "bg-black border-neutral-800 text-neutral-500 hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setGrantModal({ ...grantModal, isOpen: false })}
                className="flex-1 px-6 py-4 bg-neutral-800 hover:bg-neutral-700 text-white font-black rounded-2xl text-[11px] uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={grantModal.submitting || !grantModal.identifier.trim()}
                onClick={async () => {
                  try {
                    setGrantModal(prev => ({ ...prev, submitting: true, error: null, message: null }));
                    const res = await assignUserRole(currentUser.id, { identifier: grantModal.identifier.trim(), role: grantModal.role });
                    setGrantModal(prev => ({
                      ...prev,
                      submitting: false,
                      message: `Successfully granted ${grantModal.role.toUpperCase()} role to ${res?.user?.codmIgn || grantModal.identifier}!`,
                      identifier: "",
                    }));
                    if (typeof loadUsers === "function") loadUsers();
                  } catch (err: any) {
                    setGrantModal(prev => ({ ...prev, submitting: false, error: err.message || "Failed to assign role" }));
                  }
                }}
                className="flex-1 px-6 py-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black font-black rounded-2xl text-[11px] uppercase tracking-widest transition-all shadow-xl shadow-amber-400/10 flex items-center justify-center gap-2"
              >
                {grantModal.submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                Confirm Grant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

