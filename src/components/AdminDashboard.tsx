import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
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
  Maximize2
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
  GmailIntegrationStatus,
  AdminEmailItem,
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
  const [activeTab, setActiveTab] = useState<'review_queue' | 'finance' | 'users' | 'gmail' | 'disputes'>('review_queue');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Review Queue Moderation state
  const [reviewQueueMatches, setReviewQueueMatches] = useState<Match[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueFilter, setQueueFilter] = useState<'all' | 'disputed' | 'ai_flagged' | 'resubmit'>('all');
  const [queueSearch, setQueueSearch] = useState('');

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

  // Disputes Hub state
  const [disputesList, setDisputesList] = useState<Match[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Match | null>(null);

  // Users & Role Management state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [assignIdentifier, setAssignIdentifier] = useState('');
  const [assignRoleType, setAssignRoleType] = useState<'admin' | 'user'>('admin');
  const [assignMsg, setAssignMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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
        headers: { 'Content-Type': 'application/json', 'X-Admin-Id': currentUser.id },
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

  const reloadAll = async () => {
    setRefreshing(true);
    await Promise.all([loadFinance(), loadUsers(), loadGmail(), loadDisputes(), loadReviewQueue()]);
    if (onRefreshUser) onRefreshUser();
    setRefreshing(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (currentUser.role === 'admin') {
        await Promise.all([loadFinance(), loadUsers(), loadGmail(), loadDisputes(), loadReviewQueue()]);
      }
      setLoading(false);
    };
    init();
  }, [currentUser.id, currentUser.role]);

  // Moderation Handlers
  const handleApprovePayoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payoutModal.match || !payoutModal.selectedWinnerId) return;
    setPayoutModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      await adminResolveMatch(payoutModal.match.id, payoutModal.selectedWinnerId);
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

  if (currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 bg-neutral-900 border border-neutral-800 rounded-[2rem] text-white space-y-8 max-w-2xl mx-auto shadow-2xl animate-in zoom-in-95 duration-500">
        <div className="w-24 h-24 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
          <ShieldCheck size={48} />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Sector Restricted</h2>
          <p className="text-neutral-500 max-w-xs mx-auto leading-relaxed">Authorization required. Only Level-4 Administrative Gladiators can access the Command Center.</p>
        </div>
        <form onSubmit={async (e) => { e.preventDefault(); try { await claimAdminRole(currentUser.id, adminPasscode.trim()); window.location.reload(); } catch(err:any) { setClaimMsg(err.message); } }} className="w-full space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest ml-4">Terminal Passcode</label>
            <input type="password" value={adminPasscode} onChange={e => setAdminPasscode(e.target.value)} placeholder="••••••••" className="w-full bg-black border border-neutral-800 rounded-2xl px-6 py-5 text-center font-mono tracking-[1em] focus:border-amber-400 focus:outline-none transition-all placeholder:tracking-normal placeholder:font-sans" />
          </div>
          {claimMsg && <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-black uppercase tracking-widest text-center rounded-xl">{claimMsg}</div>}
          <button type="submit" className="w-full bg-amber-400 text-black font-black py-5 rounded-2xl uppercase tracking-[0.2em] hover:bg-amber-300 transition-all active:scale-[0.98] shadow-lg shadow-amber-400/20">Authorize Terminal</button>
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
            <div className="w-14 h-14 rounded-2xl bg-amber-400 flex items-center justify-center text-black font-black text-2xl shadow-xl shadow-amber-400/20">A</div>
            <div>
              <h1 className="font-black text-white uppercase tracking-tighter text-2xl leading-none">HQ COMMAND</h1>
              <p className="text-[10px] text-amber-400 font-bold uppercase tracking-[0.2em] mt-1.5 opacity-80">Admin Sector</p>
            </div>
          </div>

          <nav className="flex flex-col gap-3">
            {[
              { id: 'review_queue', icon: AlertTriangle, label: 'Review Queue', badge: reviewQueueMatches.length },
              { id: 'finance', icon: Wallet, label: 'Treasury', badge: `₦${availableFees.toLocaleString()}` },
              { id: 'users', icon: Users, label: 'Gladiators', badge: usersList.length },
              { id: 'disputes', icon: ShieldCheck, label: 'Disputes', badge: disputesList.length },
              { id: 'gmail', icon: Mail, label: 'Sync Engine', badge: emailsList.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-between p-4.5 rounded-[1.25rem] transition-all duration-300 group relative overflow-hidden ${activeTab === tab.id ? 'bg-amber-400 text-black shadow-lg shadow-amber-400/10' : 'text-neutral-400 hover:bg-neutral-800 hover:text-white'}`}
              >
                <div className="flex items-center gap-3.5 relative z-10">
                  <tab.icon size={20} className={activeTab === tab.id ? 'text-black' : 'text-neutral-500 group-hover:text-amber-400 transition-colors'} />
                  <span className="text-[11px] font-black uppercase tracking-widest">{tab.label}</span>
                </div>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg relative z-10 ${activeTab === tab.id ? 'bg-black/10' : 'bg-neutral-800/50 text-neutral-500'}`}>{tab.badge}</span>
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
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
        
        {/* HEADER SUMMARY CARDS */}
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

                        <div className="text-right">
                          <div className="text-base font-black text-emerald-400 font-mono">
                            ₦{match.potAmount.toLocaleString()} POT
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            ₦{match.stakeAmount.toLocaleString()} stake · ₦{match.winnerPayout.toLocaleString()} payout
                          </div>
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

                      {/* Dual Player Breakdown (Host vs Rival) */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Host Side */}
                        <div className="p-4 rounded-2xl bg-black/40 border border-neutral-800 space-y-3.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img src={match.creator.avatar} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 object-cover shrink-0" />
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
                                <img src={match.creator.screenshotUrl} alt="Host proof" className="w-full h-full object-contain" />
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
                                  {match.creator.resubmissionRequested ? 'Resubmission Awaited' : 'No Screenshot Uploaded'}
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
                              <img src={match.opponent?.avatar || '/placeholder.png'} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 object-cover shrink-0" />
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
                                <img src={match.opponent.screenshotUrl} alt="Rival proof" className="w-full h-full object-contain" />
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
                                  {match.opponent?.resubmissionRequested ? 'Resubmission Awaited' : 'No Screenshot Uploaded'}
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

                      {/* 3 Quick-Action Moderation Buttons */}
                      <div className="pt-2 border-t border-neutral-800/80 flex flex-wrap items-center gap-3">
                        {/* 1. Approve Payout */}
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
                              headers: { 'Content-Type': 'application/json' },
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
                    {(['all', 'admin', 'user'] as const).map(f => (
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
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black border tracking-widest ${u.role === 'admin' ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-500'}`}>
                               {u.role.toUpperCase()}
                             </span>
                          </td>
                          <td className="px-10 py-7 text-right">
                             <div className="flex items-center justify-end gap-3">
                               <button 
                                onClick={() => setBalanceModal({ ...balanceModal, isOpen: true, user: u })} 
                                className="p-3 bg-neutral-800 hover:bg-amber-400/10 text-amber-400 rounded-2xl transition-all border border-neutral-800 hover:border-amber-400/40 active:scale-90"
                                title="Adjust Balance"
                               >
                                 <Coins size={18} />
                               </button>
                               <button 
                                onClick={async () => { if(confirm(`Adjust permissions for gladiator ${u.codmIgn}?`)) { await assignUserRole(currentUser.id, { targetUserId: u.id, role: u.role === 'admin' ? 'user' : 'admin' }); loadUsers(); } }} 
                                className={`p-3 rounded-2xl transition-all border border-neutral-800 active:scale-90 ${u.role === 'admin' ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/40' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500/40'}`}
                                title="Change Role"
                               >
                                 <Shield size={18} />
                               </button>
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
                             <img src={selectedDispute.creator.avatar} className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700" alt="" />
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
                             <img src={selectedDispute.opponent?.avatar} className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700" alt="" />
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
                         onClick={async () => { if(confirm(`Award victory and ₦${selectedDispute.winnerPayout.toLocaleString()} to ${selectedDispute.creator.codmIgn}?`)) { await adminResolveMatch(selectedDispute.id, selectedDispute.creator.id); setSelectedDispute(null); loadDisputes(); } }}
                         className="px-6 py-4 bg-emerald-500 text-black font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/10 hover:bg-emerald-400 transition-all active:scale-95"
                       >
                         Victory to Host
                       </button>
                       <button 
                         onClick={async () => { if(selectedDispute.opponent && confirm(`Award victory and ₦${selectedDispute.winnerPayout.toLocaleString()} to ${selectedDispute.opponent.codmIgn}?`)) { await adminResolveMatch(selectedDispute.id, selectedDispute.opponent.id); setSelectedDispute(null); loadDisputes(); } }}
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
                  <img src={payoutModal.match.creator.avatar} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 object-cover" />
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
                    <img src={payoutModal.match.opponent.avatar} alt="" className="w-8 h-8 rounded-lg bg-neutral-800 object-cover" />
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
              <img
                src={lightboxData.url}
                alt={`${lightboxData.playerIgn} proof`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg border border-neutral-800 shadow-2xl"
              />
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
    </div>
  );
};
