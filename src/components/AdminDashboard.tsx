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
  UserX,
  AlertCircle,
  Building2,
  CreditCard,
  User,
  Phone,
  Mail,
  Wallet,
  Sparkles,
  Zap,
  TrendingUp,
  Coins,
  History,
  Check,
  ArrowUpRight,
  Filter,
  PlusCircle,
  MinusCircle,
  X,
  Inbox,
  Key,
  Copy,
  ExternalLink,
  Eye,
  Trash2,
  Settings,
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
  GmailIntegrationStatus,
  AdminEmailItem,
} from '../services/api';

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
  const [activeTab, setActiveTab] = useState<'finance' | 'users' | 'gmail'>('finance');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Platform Fee Treasury state
  const [finance, setFinance] = useState<AdminFinanceData | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawSuccessMsg, setWithdrawSuccessMsg] = useState<string | null>(null);
  const [withdrawErrorMsg, setWithdrawErrorMsg] = useState<string | null>(null);

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

  // Passcode claim for unassigned admin
  const [adminPasscode, setAdminPasscode] = useState('');
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  // Load finance stats
  const loadFinance = async () => {
    try {
      const data = await fetchAdminFinance(currentUser.id);
      setFinance(data);
    } catch (e) {
      console.error('Error loading platform finance:', e);
    }
  };

  // Load registered users
  const loadUsers = async () => {
    try {
      const list = await fetchAdminUsers(currentUser.id, usersSearch);
      setUsersList(list);
    } catch (e) {
      console.error('Error loading users:', e);
    }
  };

  // Load Gmail status and emails
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

  const reloadAll = async () => {
    setRefreshing(true);
    await Promise.all([loadFinance(), loadUsers(), loadGmail()]);
    if (onRefreshUser) onRefreshUser();
    setRefreshing(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (currentUser.role === 'admin') {
        await Promise.all([loadFinance(), loadUsers(), loadGmail()]);
      }
      setLoading(false);
    };
    init();
  }, [currentUser.id, currentUser.role]);

  // Gmail Actions
  const handleSyncGmail = async () => {
    setGmailSyncing(true);
    setGmailSyncMsg(null);
    try {
      const res = await triggerGmailSync(currentUser.id);
      setGmailSyncMsg({
        type: 'success',
        text: res.message || `Fetched ${res.newEmailsCount || 0} new email(s)!`,
      });
      await loadGmail();
    } catch (err: any) {
      setGmailSyncMsg({ type: 'error', text: err.message || 'Failed to sync Gmail' });
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
      alert('Gmail account disconnected successfully.');
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
      alert(res.message || `Cleaned up ${res.count} verified mail(s) older than 3 minutes.`);
      const fresh = await fetchAdminMailbox(currentUser.id);
      setEmailsList(fresh);
    } catch (err: any) {
      alert(err.message || 'Failed to clean up verified emails');
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

  // Handle Withdraw Platform Fees to Admin Account
  const handleExecuteFeeWithdrawal = async (amountToWithdraw?: number) => {
    const targetAmount = amountToWithdraw || parseFloat(withdrawAmount);
    if (!targetAmount || targetAmount <= 0) {
      setWithdrawErrorMsg('Please enter a valid amount to withdraw');
      return;
    }

    const available = finance?.available_fees ?? 0;
    if (targetAmount > available) {
      setWithdrawErrorMsg(`Amount exceeds available platform balance (₦${available.toLocaleString()})`);
      return;
    }

    setIsWithdrawing(true);
    setWithdrawSuccessMsg(null);
    setWithdrawErrorMsg(null);

    try {
      await withdrawPlatformFees(currentUser.id, targetAmount);
      setWithdrawSuccessMsg(`Successfully withdrawn ₦${targetAmount.toLocaleString()} to your admin wallet balance!`);
      setWithdrawAmount('');
      await loadFinance();
      if (onRefreshUser) onRefreshUser();
    } catch (err: any) {
      setWithdrawErrorMsg(err.message || 'Failed to withdraw platform fees');
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle Assigning Role by Email or IGN
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

  // Handle Quick Toggle in user list
  const handleToggleUserRole = async (targetUser: any) => {
    const nextRole = targetUser.role === 'admin' ? 'user' : 'admin';
    const confirmMsg =
      targetUser.role === 'admin'
        ? `Revoke Admin privileges from ${targetUser.codmIgn || targetUser.email}?`
        : `Promote ${targetUser.codmIgn || targetUser.email} to Admin?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await assignUserRole(currentUser.id, {
        targetUserId: targetUser.id,
        role: nextRole,
      });
      alert(res.message);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to update user role');
    }
  };

  // Handle Admin User Balance Adjustment
  const handleAdjustBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balanceModal.user) return;
    const numAmount = parseFloat(balanceModal.amount);
    if (!numAmount || numAmount <= 0) {
      setBalanceModal(prev => ({ ...prev, error: 'Please enter a valid amount' }));
      return;
    }

    setBalanceModal(prev => ({ ...prev, isSubmitting: true, error: null }));
    try {
      const res = await adjustUserBalance(
        currentUser.id,
        balanceModal.user.id,
        numAmount,
        balanceModal.type,
        balanceModal.reason.trim() || `Admin manual ${balanceModal.type}`
      );
      alert(res.message || 'Gladiator balance adjusted successfully!');
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
    } catch (err: any) {
      setBalanceModal(prev => ({ ...prev, isSubmitting: false, error: err.message || 'Failed to adjust balance' }));
    }
  };

  // Handle Claim Admin with Passcode
  const handleClaimAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await claimAdminRole(currentUser.id, adminPasscode.trim());
      alert(res.message);
      window.location.reload();
    } catch (err: any) {
      setClaimMsg(err.message || 'Unauthorized admin credentials');
    }
  };

  // If current user is not marked as admin
  if (currentUser.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-white space-y-6 shadow-2xl">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-wider">Admin Verification Required</h2>
          <p className="text-sm text-neutral-400">
            Account <span className="text-amber-400 font-mono font-bold">{currentUser.email || currentUser.codmIgn}</span> does not have active Admin privileges.
          </p>
        </div>

        <form onSubmit={handleClaimAdmin} className="space-y-4 pt-4 border-t border-neutral-800">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
            Enter Admin Security Passcode
          </label>
          <input
            type="password"
            value={adminPasscode}
            onChange={(e) => setAdminPasscode(e.target.value)}
            placeholder="Security passcode..."
            className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm focus:outline-none focus:border-amber-400"
          />
          {claimMsg && <p className="text-xs text-rose-400">{claimMsg}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            Verify Admin Access
          </button>
        </form>
      </div>
    );
  }

  const availableFees = finance?.available_fees ?? Math.max(0, (finance?.total_fees_collected ?? 0) - (finance?.total_fees_withdrawn ?? 0));
  const totalCollected = finance?.total_fees_collected ?? 0;
  const totalWithdrawn = finance?.total_fees_withdrawn ?? 0;

  const filteredUsers = usersList.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (usersSearch.trim()) {
      const q = usersSearch.toLowerCase();
      return (
        (u.codmIgn && u.codmIgn.toLowerCase().includes(q)) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.accountNumber && u.accountNumber.includes(q))
      );
    }
    return true;
  });

  const adminsCount = usersList.filter((u) => u.role === 'admin').length;
  const regularUsersCount = usersList.filter((u) => u.role !== 'admin').length;

  const filteredEmails = emailsList.filter((m) => {
    if (emailFilter === 'unread' && m.isRead) return false;
    if (emailFilter === 'alerts') {
      const text = (m.subject + ' ' + m.body).toLowerCase();
      if (!text.includes('opay') && !text.includes('deposit') && !text.includes('credit') && !text.includes('transfer') && !text.includes('payment')) {
        return false;
      }
    }
    if (emailSearch.trim()) {
      const q = emailSearch.toLowerCase();
      return (
        m.subject.toLowerCase().includes(q) ||
        m.senderEmail.toLowerCase().includes(q) ||
        m.senderName.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const unreadMailsCount = emailsList.filter((m) => !m.isRead).length;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-white">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-amber-950/20 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span className="p-2.5 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-amber-400">
                <ShieldCheck className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase font-heading">
                  Platform Admin Portal
                </h1>
                <p className="text-xs text-neutral-400">
                  Signed in as <strong className="text-amber-400">{currentUser.codmIgn}</strong> ({currentUser.email || 'Admin'})
                </p>
              </div>
              <span className="px-3 py-1 text-[11px] font-black tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Fee Rake Active
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl">
              Manage platform operations, track the automated 10% match fee treasury, cash out accumulated platform revenue, and oversee gladiator accounts and administrative roles.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={reloadAll}
              disabled={refreshing}
              className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl flex items-center gap-2 border border-neutral-700 transition cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>Refresh Portal</span>
            </button>
          </div>
        </div>

        {/* Streamlined Tab Switcher (Only Fee Wallet & Manage Users) */}
        <div className="flex items-center gap-3 mt-8 pt-6 border-t border-neutral-800/80">
          <button
            onClick={() => setActiveTab('finance')}
            className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2.5 uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-amber-400 text-neutral-950 shadow-xl shadow-amber-400/20'
                : 'bg-neutral-800/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60'
            }`}
          >
            <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Platform Fee Wallet & Treasury</span>
            <span className={`px-2 py-0.5 text-[11px] rounded-full font-mono font-bold ${
              activeTab === 'finance' ? 'bg-neutral-950 text-amber-400' : 'bg-neutral-900 text-emerald-400'
            }`}>
              ₦{availableFees.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2.5 uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'users'
                ? 'bg-amber-400 text-neutral-950 shadow-xl shadow-amber-400/20'
                : 'bg-neutral-800/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60'
            }`}
          >
            <UserCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Manage Gladiators & Roles</span>
            <span className={`px-2 py-0.5 text-[11px] rounded-full font-mono font-bold ${
              activeTab === 'users' ? 'bg-neutral-950 text-amber-400' : 'bg-neutral-900 text-neutral-400'
            }`}>
              {usersList.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('gmail')}
            className={`px-5 py-3 rounded-2xl text-xs sm:text-sm font-black flex items-center gap-2.5 uppercase tracking-wider transition cursor-pointer ${
              activeTab === 'gmail'
                ? 'bg-amber-400 text-neutral-950 shadow-xl shadow-amber-400/20'
                : 'bg-neutral-800/90 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/60'
            }`}
          >
            <Mail className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Gmail Alerts & Live Inbox</span>
            {gmailStatus?.configured ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" title="Gmail Connected & Active" />
            ) : null}
            <span className={`px-2 py-0.5 text-[11px] rounded-full font-mono font-bold ${
              activeTab === 'gmail' ? 'bg-neutral-950 text-amber-400' : 'bg-neutral-900 text-neutral-400'
            }`}>
              {emailsList.length}
            </span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PLATFORM FEE WALLET & TREASURY                    */}
      {/* ======================================================== */}
      {activeTab === 'finance' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Treasury KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Available Treasury Card */}
            <div className="p-6 bg-gradient-to-br from-neutral-900 to-emerald-950/30 border border-emerald-500/40 rounded-3xl space-y-3 relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-6 opacity-10 text-emerald-400 pointer-events-none">
                <Coins className="w-28 h-28" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Available Platform Treasury
                </span>
                <span className="text-[10px] font-mono uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold">
                  Ready to Cashout
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono tracking-tight">
                ₦{availableFees.toLocaleString()}
              </div>
              <p className="text-xs text-neutral-400">
                Accumulated 10% match fee rake funded from all completed 1v1 challenges.
              </p>
            </div>

            {/* Total Fees Funded Card */}
            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-amber-400" />
                  Total Platform Fees Funded
                </span>
                <span className="text-[10px] font-mono uppercase bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-bold">
                  All-Time
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight">
                ₦{totalCollected.toLocaleString()}
              </div>
              <p className="text-xs text-neutral-400">
                10% rake automatically deducted from pots and credited to platform on settlement.
              </p>
            </div>

            {/* Total Fees Withdrawn Card */}
            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4 text-cyan-400" />
                  Total Fees Withdrawn
                </span>
                <span className="text-[10px] font-mono uppercase bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full font-bold">
                  Cashed Out
                </span>
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight">
                ₦{totalWithdrawn.toLocaleString()}
              </div>
              <p className="text-xs text-neutral-400">
                Total rake transferred from the platform fee wallet into admin accounts.
              </p>
            </div>
          </div>

          {/* Platform Fee Cashout & Admin Funding Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-wider font-heading">
                    Cashout Platform Fees to Admin Wallet
                  </h3>
                </div>
                <p className="text-xs text-neutral-400">
                  Transfer platform fee rake directly into your personal gladiator wallet for payout or instant usage.
                </p>
              </div>

              {/* Admin Destination Wallet Info */}
              <div className="bg-neutral-950 p-3.5 rounded-2xl border border-neutral-800 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-amber-400 text-neutral-950 font-black flex items-center justify-center text-xs">
                  {(currentUser.codmIgn || 'A').slice(0, 1).toUpperCase()}
                </div>
                <div className="text-xs">
                  <div className="text-neutral-400 text-[10px] uppercase font-bold">Admin Recipient Wallet</div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>{currentUser.codmIgn}</span>
                    <span className="font-mono text-emerald-400">₦{(currentUser.balance || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Presets & Withdraw Input */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider mr-1">
                  Quick Amount:
                </span>
                {[1000, 5000, 10000, 25000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setWithdrawAmount(String(preset));
                      setWithdrawErrorMsg(null);
                    }}
                    className="px-3.5 py-1.5 bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
                  >
                    ₦{preset.toLocaleString()}
                  </button>
                ))}
                {availableFees > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setWithdrawAmount(String(availableFees));
                      setWithdrawErrorMsg(null);
                    }}
                    className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-mono font-bold transition cursor-pointer"
                  >
                    Max (₦{availableFees.toLocaleString()})
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-3 relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-neutral-500 font-bold font-mono text-base">
                    ₦
                  </div>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={withdrawAmount}
                    onChange={(e) => {
                      setWithdrawAmount(e.target.value);
                      setWithdrawErrorMsg(null);
                    }}
                    placeholder="Enter amount to withdraw from platform fee balance..."
                    className="w-full pl-9 pr-4 py-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-white font-mono text-sm focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleExecuteFeeWithdrawal()}
                  disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || availableFees <= 0}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-neutral-950 font-black uppercase tracking-wider text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  <ArrowDownCircle className={`w-4 h-4 ${isWithdrawing ? 'animate-bounce' : ''}`} />
                  {isWithdrawing ? 'Processing Cashout...' : 'Withdraw to Admin Wallet'}
                </button>
              </div>

              {withdrawSuccessMsg && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>{withdrawSuccessMsg}</span>
                </div>
              )}

              {withdrawErrorMsg && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{withdrawErrorMsg}</span>
                </div>
              )}
            </div>
          </div>

          {/* Two-Column Section: Fee Engine Info & Match Funding Activity Stream */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Platform Fee Rake Engine Explained */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                  <Zap className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider font-heading">
                    How Platform Fee Funding Works
                  </h3>
                  <p className="text-xs text-neutral-400">10% Automated Esports Match Rake Model</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-neutral-300">
                <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800/80 space-y-2">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>1. Match Stake Created</span>
                    <span className="font-mono text-white">e.g. ₦1,000 / gladiator</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>2. Total Pot Escrowed</span>
                    <span className="font-mono text-amber-400 font-bold">₦2,000 Pot</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-neutral-800 pt-2 text-white">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Sparkles className="w-3.5 h-3.5" />
                      3. Winner Payout (90%)
                    </span>
                    <span className="font-mono text-emerald-400 font-black">₦1,800</span>
                  </div>
                  <div className="flex items-center justify-between text-amber-300 font-bold">
                    <span>4. Platform Rake (10%)</span>
                    <span className="font-mono">+₦200 into this Treasury</span>
                  </div>
                </div>

                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  When a match completes and the winner is validated, the 10% rake is deducted from the escrow pot and immediately added to this Platform Fee Wallet. The funds remain stored here indefinitely until you withdraw them to your admin account.
                </p>
              </div>
            </div>

            {/* Recent Match Fee Funding Activity */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400">
                    <History className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-wider font-heading">
                      Recent Match Fee Inflows
                    </h3>
                    <p className="text-xs text-neutral-400">Live 10% fee rake stream from completed 1v1s</p>
                  </div>
                </div>
              </div>

              {(!finance?.recent_fee_matches || finance.recent_fee_matches.length === 0) ? (
                <div className="p-8 text-center bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2">
                  <Coins className="w-8 h-8 text-neutral-600 mx-auto" />
                  <div className="text-xs font-bold text-neutral-400 uppercase">No Match Fees Recorded Yet</div>
                  <p className="text-[11px] text-neutral-500">
                    Once players create and complete 1v1 matches, the 10% rake will automatically fund this wallet and appear here in real-time.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {finance.recent_fee_matches.map((match) => (
                    <div
                      key={match.id}
                      className="p-3 bg-neutral-950/80 hover:bg-neutral-950 border border-neutral-800 rounded-2xl flex items-center justify-between gap-3 text-xs transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                            {match.gameMode}
                          </span>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            #{match.challengeCode || match.id.slice(-6)}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-400">
                          Winner: <span className="text-amber-400 font-bold">{match.winnerIgn}</span> • Pot: ₦{match.potAmount.toLocaleString()}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-black text-emerald-400 text-sm">
                          +₦{match.platformFee.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-neutral-500 uppercase tracking-wider font-bold">
                          10% Rake
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Fee Withdrawal History */}
          {finance?.recent_withdrawals && finance.recent_withdrawals.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
                  <ArrowDownCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wider font-heading">
                    Fee Cashout History
                  </h3>
                  <p className="text-xs text-neutral-400">Recent withdrawals transferred to admin wallet</p>
                </div>
              </div>

              <div className="divide-y divide-neutral-800/80 bg-neutral-950/80 rounded-2xl border border-neutral-800 overflow-hidden text-xs">
                {finance.recent_withdrawals.map((tx) => (
                  <div key={tx.id} className="p-3.5 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white">{tx.description}</div>
                      <div className="text-[10px] text-neutral-500 font-mono">
                        {new Date(tx.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="font-mono font-black text-white text-sm">
                      -₦{tx.amount.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: MANAGE USERS & ROLES                              */}
      {/* ======================================================== */}
      {activeTab === 'users' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Fast Role Assignment Box */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
            <div className="flex items-center gap-3">
              <span className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400">
                <UserCheck className="w-6 h-6" />
              </span>
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider font-heading">
                  Assign Admin Role
                </h3>
                <p className="text-xs text-neutral-400">
                  Grant administrative access (platform finance management, gladiator oversight) to any player.
                </p>
              </div>
            </div>

            <form onSubmit={handleAssignRoleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    User Email Address or CODM IGN *
                  </label>
                  <input
                    type="text"
                    value={assignIdentifier}
                    onChange={(e) => setAssignIdentifier(e.target.value)}
                    placeholder="e.g. b@gmail.com, Ghost_NG, or loganhayes09@gmail.com"
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-2xl text-sm text-white focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    Role to Assign
                  </label>
                  <select
                    value={assignRoleType}
                    onChange={(e) => setAssignRoleType(e.target.value as any)}
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-2xl text-sm text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="admin">ADMIN (Full Rights)</option>
                    <option value="user">USER (Standard Player)</option>
                  </select>
                </div>
              </div>

              {assignMsg && (
                <div
                  className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2.5 ${
                    assignMsg.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                  }`}
                >
                  {assignMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  {assignMsg.text}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isAssigning || !assignIdentifier.trim()}
                  className="px-6 py-3 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-2xl transition cursor-pointer shadow-lg shadow-amber-400/20"
                >
                  {isAssigning ? 'Updating Role...' : 'Save Role Assignment'}
                </button>
              </div>
            </form>
          </div>

          {/* Registered Gladiators Directory */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-wider font-heading">
                  Registered Gladiators Directory
                </h3>
                <p className="text-xs text-neutral-400">
                  {usersList.length} total players registered ({adminsCount} admins, {regularUsersCount} standard users)
                </p>
              </div>

              {/* Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
                  {(['all', 'admin', 'user'] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setRoleFilter(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition cursor-pointer ${
                        roleFilter === r
                          ? 'bg-amber-400 text-neutral-950 font-black'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      {r === 'all' ? 'All' : r === 'admin' ? `Admins (${adminsCount})` : `Players (${regularUsersCount})`}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="Search gladiator, email, bank..."
                    value={usersSearch}
                    onChange={(e) => setUsersSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-400">
                    <th className="py-3 px-3">Gladiator</th>
                    <th className="py-3 px-3">Contact</th>
                    <th className="py-3 px-3">Bank Details (NUBAN)</th>
                    <th className="py-3 px-3">Wallet Balance</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-neutral-500">
                        No gladiator records found matching search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isAdmin = u.role === 'admin';
                      return (
                        <tr key={u.id} className="hover:bg-neutral-800/30 transition">
                          <td className="py-3.5 px-3 font-bold text-white">
                            <div className="flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-black text-amber-400">
                                {(u.codmIgn || u.username || 'U').slice(0, 1).toUpperCase()}
                              </span>
                              <div>
                                <div className="text-white font-bold">{u.codmIgn || u.username}</div>
                                <div className="text-[10px] text-neutral-500 font-mono">ID: {u.id.slice(-6)}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-neutral-300">
                            <div>{u.email || '—'}</div>
                            <div className="text-[11px] text-neutral-500 font-mono">{u.phone || ''}</div>
                          </td>
                          <td className="py-3.5 px-3 text-neutral-300">
                            {u.accountNumber ? (
                              <div>
                                <span className="font-mono text-emerald-400 font-bold">{u.accountNumber}</span>
                                <div className="text-[10px] text-neutral-500 truncate max-w-[140px]">
                                  {u.bankName} • {u.accountName}
                                </div>
                              </div>
                            ) : (
                              <span className="text-neutral-500 italic">Not configured</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 font-mono font-bold text-amber-400 text-sm">
                            ₦{(u.balance || 0).toLocaleString()}
                          </td>
                          <td className="py-3.5 px-3">
                            {isAdmin ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">
                                ADMIN
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400 border border-neutral-700">
                                GLADIATOR
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setBalanceModal({
                                    isOpen: true,
                                    user: u,
                                    amount: '',
                                    type: 'credit',
                                    reason: '',
                                    isSubmitting: false,
                                    error: null,
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-neutral-800 hover:bg-neutral-700 text-amber-400 border border-neutral-700 transition cursor-pointer"
                              >
                                Adjust Balance
                              </button>

                              <button
                                onClick={() => handleToggleUserRole(u)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                  isAdmin
                                    ? 'bg-neutral-800 hover:bg-rose-500/20 text-rose-400 border border-neutral-700'
                                    : 'bg-neutral-800 hover:bg-emerald-500/20 text-emerald-400 border border-neutral-700'
                                }`}
                              >
                                {isAdmin ? 'Revoke Admin' : 'Make Admin'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: GMAIL ALERTS & LIVE INBOX                         */}
      {/* ======================================================== */}
      {activeTab === 'gmail' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Top Gmail Status & Controls Banner */}
          <div className="bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-950/20 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <span className={`p-2.5 rounded-2xl border ${
                    gmailStatus?.configured
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                      : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                  }`}>
                    <Mail className="w-6 h-6" />
                  </span>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white font-heading">
                      Gmail Live Inbox & Alert Stream
                    </h2>
                    <p className="text-xs text-neutral-400">
                      {gmailStatus?.configured ? (
                        <>Connected to: <strong className="text-emerald-400">{gmailStatus.gmailAddress}</strong> (Render IMAP Sync Active)</>
                      ) : (
                        <>No Gmail account connected yet</>
                      )}
                    </p>
                  </div>

                  {gmailStatus?.configured ? (
                    <span className="px-3 py-1 text-[11px] font-black tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Auto-Sync Active (Every 3m)
                    </span>
                  ) : (
                    <span className="px-3 py-1 text-[11px] font-black tracking-wider uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-full flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Ready To Connect
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-neutral-300 max-w-2xl">
                  {gmailStatus?.configured
                    ? 'Emails are fetched directly from your Gmail inbox using secure SSL IMAP. Great for tracking bank alerts, OPay notifications, deposit proofs, and gladiator inquiries without OAuth redirect issues on Render.'
                    : 'Connect any Gmail address in under 60 seconds with a free Google App Password. Works seamlessly on your Render deployment (https://codm-new.onrender.com) with zero domain verification or OAuth hassle.'
                  }
                </p>

                {gmailStatus?.configured && (
                  <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-neutral-400 font-mono">
                    <span>
                      Last Synced:{' '}
                      <strong className="text-neutral-200">
                        {gmailStatus.lastSyncedAt
                          ? new Date(gmailStatus.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : 'Never'}
                      </strong>
                    </span>
                    <span>•</span>
                    <span>
                      Total Synced:{' '}
                      <strong className="text-amber-400">{gmailStatus.totalEmailsSynced} emails</strong>
                    </span>
                    {gmailStatus.lastSyncStatus === 'error' && gmailStatus.lastSyncError && (
                      <span className="text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        Sync error: {gmailStatus.lastSyncError}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3">
                {gmailStatus?.configured ? (
                  <>
                    <button
                      onClick={handleSyncGmail}
                      disabled={gmailSyncing}
                      className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-black rounded-xl uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shadow-lg shadow-amber-400/20 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${gmailSyncing ? 'animate-spin' : ''}`} />
                      <span>{gmailSyncing ? 'Syncing Gmail...' : 'Sync Gmail Now'}</span>
                    </button>

                    <button
                      onClick={handleTestGmail}
                      disabled={gmailSyncing}
                      className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-neutral-700 transition cursor-pointer"
                      title="Test connection to imap.gmail.com"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-400" />
                      <span>Test Connection</span>
                    </button>

                    <button
                      onClick={() => {
                        setGmailForm({
                          address: gmailStatus.gmailAddress || '',
                          password: '',
                          autoSync: gmailStatus.autoSync,
                          isSubmitting: false,
                          error: null,
                          success: null,
                        });
                        setConnectModalOpen(true);
                      }}
                      className="px-3.5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-neutral-700 transition cursor-pointer"
                      title="Update Gmail credentials"
                    >
                      <Settings className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Settings</span>
                    </button>

                    <button
                      onClick={handleDisconnectGmail}
                      className="px-3.5 py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30 transition cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConnectModalOpen(true)}
                    className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs sm:text-sm font-black rounded-xl uppercase tracking-wider flex items-center gap-2 transition cursor-pointer shadow-xl shadow-amber-400/25"
                  >
                    <Mail className="w-5 h-5" />
                    <span>Connect Gmail Account</span>
                  </button>
                )}
              </div>
            </div>

            {/* Notification alert banner */}
            {gmailSyncMsg && (
              <div className={`mt-4 p-3 rounded-xl text-xs font-bold flex items-center justify-between ${
                gmailSyncMsg.type === 'success'
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}>
                <div className="flex items-center gap-2">
                  {gmailSyncMsg.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                  )}
                  <span>{gmailSyncMsg.text}</span>
                </div>
                <button
                  onClick={() => setGmailSyncMsg(null)}
                  className="text-neutral-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Quick Guide Card */}
          <div>
            {/* How to generate Google App Password Card */}
            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  How To Get Your Free App Password
                </span>
                <button
                  onClick={() => setShowHowToHelp(!showHowToHelp)}
                  className="text-xs text-amber-400 hover:underline font-bold cursor-pointer"
                >
                  {showHowToHelp ? 'Hide Guide' : 'View 4 Steps'}
                </button>
              </div>
              <p className="text-xs text-neutral-400">
                Google provides 16-character App Passwords free forever for any Gmail account with 2-Step Verification enabled.
              </p>
              {showHowToHelp ? (
                <div className="space-y-2 text-xs text-neutral-300 bg-neutral-950 p-3.5 rounded-xl border border-neutral-800">
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">1</span>
                    <span>Go to <strong className="text-white">myaccount.google.com/security</strong></span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">2</span>
                    <span>Ensure <strong className="text-white">2-Step Verification</strong> is ON</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">3</span>
                    <span>Search or select <strong className="text-white">App Passwords</strong> and create one named "CODM Admin"</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-[10px] shrink-0">4</span>
                    <span>Copy the 16 letters (e.g. <code className="text-amber-400 font-mono">abcd efgh ijkl mnop</code>) and paste into Connect Gmail!</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-neutral-400">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>No Google Cloud project or OAuth verification required. Works on any VPS or Render deployment.</span>
                </div>
              )}
            </div>
          </div>

          {/* Email Inbox List */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Search and filter toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                  <Inbox className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-black uppercase text-white font-heading">
                    Admin Received Mailbox
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Showing {filteredEmails.length} of {emailsList.length} emails
                  </p>
                </div>
              </div>

              {/* Filter pills and search */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded-xl p-1">
                  <button
                    onClick={() => setEmailFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      emailFilter === 'all'
                        ? 'bg-amber-400 text-neutral-950 shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    All ({emailsList.length})
                  </button>
                  <button
                    onClick={() => setEmailFilter('unread')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                      emailFilter === 'unread'
                        ? 'bg-amber-400 text-neutral-950 shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Unread ({unreadMailsCount})
                  </button>
                  <button
                    onClick={() => setEmailFilter('alerts')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                      emailFilter === 'alerts'
                        ? 'bg-amber-400 text-neutral-950 shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Payment / OPay Alerts
                  </button>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={emailSearch}
                    onChange={(e) => setEmailSearch(e.target.value)}
                    placeholder="Search emails..."
                    className="pl-9 pr-4 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 w-48 sm:w-60"
                  />
                  {emailSearch && (
                    <button
                      onClick={() => setEmailSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={handleCleanupVerifiedEmails}
                  disabled={cleaningVerifiedMails}
                  title="Clear verified emails older than 3 minutes from the database"
                  className="px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-emerald-500/40 text-neutral-300 hover:text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shrink-0"
                >
                  <Trash2 className={`w-3.5 h-3.5 text-emerald-400 ${cleaningVerifiedMails ? 'animate-spin' : ''}`} />
                  <span>{cleaningVerifiedMails ? 'Cleaning...' : 'Clear Verified'}</span>
                </button>
              </div>
            </div>

            {/* Email Items Table / List */}
            {emailsLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3 text-neutral-400">
                <RefreshCw className="w-8 h-8 animate-spin text-amber-400" />
                <p className="text-xs">Loading received emails...</p>
              </div>
            ) : filteredEmails.length === 0 ? (
              <div className="py-14 text-center space-y-4 border border-dashed border-neutral-800 rounded-2xl bg-neutral-950/50 p-8">
                <div className="w-12 h-12 rounded-2xl bg-neutral-800 flex items-center justify-center mx-auto text-neutral-500">
                  <Mail className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-neutral-300">No emails found</h4>
                  <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                    {gmailStatus?.configured
                      ? 'No messages matched your filter. Click "Sync Gmail Now" to check for newly arrived emails!'
                      : 'Connect your Gmail account above to start receiving alerts and emails here.'
                    }
                  </p>
                </div>
                {gmailStatus?.configured && (
                  <button
                    onClick={handleSyncGmail}
                    disabled={gmailSyncing}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-amber-400 text-xs font-bold rounded-xl border border-neutral-700 inline-flex items-center gap-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${gmailSyncing ? 'animate-spin' : ''}`} />
                    <span>Sync Gmail Now</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80 rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-950/60">
                {filteredEmails.map((email) => {
                  const isDepositAlert = (email.subject + ' ' + email.body).toLowerCase().includes('opay') ||
                    (email.subject + ' ' + email.body).toLowerCase().includes('deposit');

                  return (
                    <div
                      key={email.id}
                      className={`p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-neutral-800/50 ${
                        !email.isRead ? 'bg-amber-500/[0.04]' : ''
                      }`}
                      onClick={() => {
                        setEmailViewerModal(email);
                        if (!email.isRead) {
                          handleToggleReadStatus(email);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Unread dot or initial circle */}
                        <div className="relative shrink-0 pt-0.5">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                            isDepositAlert
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-neutral-800 text-neutral-300 border border-neutral-700'
                          }`}>
                            {email.senderName ? email.senderName.charAt(0).toUpperCase() : 'M'}
                          </div>
                          {!email.isRead && (
                            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 border-2 border-neutral-950 animate-pulse" />
                          )}
                        </div>

                        {/* Mail content preview */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`text-xs font-bold ${!email.isRead ? 'text-white' : 'text-neutral-300'}`}>
                              {email.senderName || email.senderEmail}
                            </span>
                            <span className="text-[11px] text-neutral-500 font-mono">
                              &lt;{email.senderEmail}&gt;
                            </span>
                            {email.isVerified && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-md flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Verified
                              </span>
                            )}
                            {isDepositAlert && !email.isVerified && (
                              <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-md">
                                Payment Alert
                              </span>
                            )}
                            {!email.isRead && (
                              <span className="px-1.5 py-0.2 text-[9px] font-black uppercase tracking-wider bg-amber-400/20 text-amber-300 rounded border border-amber-400/30">
                                New
                              </span>
                            )}
                          </div>

                          <h4 className={`text-xs sm:text-sm font-semibold truncate ${!email.isRead ? 'text-amber-300 font-bold' : 'text-neutral-200'}`}>
                            {email.subject}
                          </h4>

                          <p className="text-xs text-neutral-400 line-clamp-1">
                            {email.body.replace(/\n+/g, ' ').substring(0, 140)}
                          </p>
                        </div>
                      </div>

                      {/* Right metadata & quick actions */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 pt-2 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                        <span className="text-[11px] text-neutral-400 font-mono">
                          {new Date(email.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(email.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEmailViewerModal(email);
                              if (!email.isRead) handleToggleReadStatus(email);
                            }}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition"
                            title="Read email"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleToggleReadStatus(email)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-amber-400 hover:bg-neutral-800 transition"
                            title={email.isRead ? 'Mark as Unread' : 'Mark as Read'}
                          >
                            <Check className={`w-4 h-4 ${email.isRead ? 'text-emerald-400' : ''}`} />
                          </button>

                          <button
                            onClick={() => handleDeleteEmailItem(email.id)}
                            className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                            title="Delete email"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Adjust Gladiator Balance */}
      {balanceModal.isOpen && balanceModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400">
                  <Wallet className="w-5 h-5" />
                </span>
                <h3 className="text-base font-black uppercase text-white font-heading">
                  Adjust Gladiator Balance
                </h3>
              </div>
              <button
                onClick={() => setBalanceModal(prev => ({ ...prev, isOpen: false }))}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-neutral-400">Gladiator:</span>
                <span className="text-white font-bold">{balanceModal.user.codmIgn || balanceModal.user.username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Email:</span>
                <span className="text-neutral-300">{balanceModal.user.email || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Current Balance:</span>
                <span className="text-emerald-400 font-bold font-mono">₦{(balanceModal.user.balance || 0).toLocaleString()}</span>
              </div>
            </div>

            <form onSubmit={handleAdjustBalanceSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Action Type:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setBalanceModal(prev => ({ ...prev, type: 'credit' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 uppercase transition ${
                      balanceModal.type === 'credit'
                        ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    <PlusCircle className="w-4 h-4" />
                    Credit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBalanceModal(prev => ({ ...prev, type: 'debit' }))}
                    className={`py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 uppercase transition ${
                      balanceModal.type === 'debit'
                        ? 'bg-rose-500 text-neutral-950 shadow-md shadow-rose-500/20'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    <MinusCircle className="w-4 h-4" />
                    Debit (-)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Adjustment Amount (₦):
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={balanceModal.amount}
                  onChange={(e) => setBalanceModal(prev => ({ ...prev, amount: e.target.value, error: null }))}
                  placeholder="e.g. 5000"
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-sm font-mono text-white focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                  Audit Reason / Note:
                </label>
                <input
                  type="text"
                  value={balanceModal.reason}
                  onChange={(e) => setBalanceModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g. Tournament reward, manual credit adjustment..."
                  className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {balanceModal.error && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold">
                  {balanceModal.error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBalanceModal(prev => ({ ...prev, isOpen: false }))}
                  className="w-1/2 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={balanceModal.isSubmitting || !balanceModal.amount}
                  className={`w-1/2 py-3 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50 transition cursor-pointer ${
                    balanceModal.type === 'credit'
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-neutral-950'
                      : 'bg-rose-500 hover:bg-rose-400 text-white'
                  }`}
                >
                  {balanceModal.isSubmitting ? 'Adjusting...' : `Confirm ${balanceModal.type.toUpperCase()}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Connect Gmail Account */}
      {connectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-amber-400">
                  <Mail className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-lg font-black uppercase text-white font-heading">
                    Connect Any Gmail Account
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Works on Render deployment • Direct IMAP SSL
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConnectModalOpen(false)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnectGmailSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
                  Your Gmail Address:
                </label>
                <input
                  type="email"
                  value={gmailForm.address}
                  onChange={(e) => setGmailForm(prev => ({ ...prev, address: e.target.value, error: null }))}
                  placeholder="e.g. b@gmail.com or onelly103@gmail.com"
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
                    Google App Password (16 Letters):
                  </label>
                  <span className="text-[10px] text-amber-400 font-mono">
                    Free forever • No OAuth
                  </span>
                </div>
                <input
                  type="password"
                  value={gmailForm.password}
                  onChange={(e) => setGmailForm(prev => ({ ...prev, password: e.target.value, error: null }))}
                  placeholder="e.g. abcd efgh ijkl mnop"
                  className="w-full px-4 py-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400 font-mono tracking-wider"
                  required
                />
              </div>

              {/* Instructions Callout */}
              <div className="p-3.5 bg-neutral-950 border border-neutral-800 rounded-2xl text-[11px] text-neutral-400 space-y-1.5">
                <p className="font-bold text-neutral-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" />
                  How to generate your App Password in 60 seconds:
                </p>
                <ol className="list-decimal list-inside space-y-1 pl-1 text-neutral-400">
                  <li>Visit <strong className="text-neutral-200">myaccount.google.com/security</strong></li>
                  <li>Enable <strong className="text-neutral-200">2-Step Verification</strong></li>
                  <li>Search <strong className="text-neutral-200">"App Passwords"</strong> and generate a code named "CODM"</li>
                  <li>Paste the 16 characters above!</li>
                </ol>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="autoSyncCheck"
                  checked={gmailForm.autoSync}
                  onChange={(e) => setGmailForm(prev => ({ ...prev, autoSync: e.target.checked }))}
                  className="w-4 h-4 rounded text-amber-400 bg-neutral-950 border-neutral-800 focus:ring-amber-400"
                />
                <label htmlFor="autoSyncCheck" className="text-xs text-neutral-300 font-semibold cursor-pointer">
                  Auto-sync emails in background every 3 minutes
                </label>
              </div>

              {gmailForm.error && (
                <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{gmailForm.error}</span>
                </div>
              )}

              {gmailForm.success && (
                <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{gmailForm.success}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConnectModalOpen(false)}
                  className="w-1/3 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={gmailForm.isSubmitting}
                  className="w-2/3 py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer shadow-lg shadow-amber-400/20 disabled:opacity-50"
                >
                  {gmailForm.isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verifying & Connecting...</span>
                    </>
                  ) : (
                    <span>Test & Connect Gmail</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Full Email Viewer */}
      {emailViewerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-5 text-white animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-800 pb-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-neutral-800 text-neutral-300 rounded font-mono">
                    {emailViewerModal.folder || 'INBOX'}
                  </span>
                  {emailViewerModal.isVerified && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Verified
                    </span>
                  )}
                  <span className="text-xs text-neutral-400 font-mono">
                    {new Date(emailViewerModal.createdAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-black text-amber-300 font-heading">
                  {emailViewerModal.subject}
                </h3>
                <div className="text-xs text-neutral-300">
                  From: <strong className="text-white">{emailViewerModal.senderName}</strong>{' '}
                  <span className="text-neutral-500 font-mono">&lt;{emailViewerModal.senderEmail}&gt;</span>
                </div>
              </div>

              <button
                onClick={() => setEmailViewerModal(null)}
                className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Email Body */}
            <div className="flex-1 overflow-y-auto bg-neutral-950 p-4 sm:p-6 rounded-2xl border border-neutral-800 font-sans text-xs sm:text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap select-text">
              {emailViewerModal.body}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleReadStatus(emailViewerModal)}
                  className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl flex items-center gap-1.5 border border-neutral-700 transition"
                >
                  <Check className={`w-3.5 h-3.5 ${emailViewerModal.isRead ? 'text-emerald-400' : ''}`} />
                  <span>{emailViewerModal.isRead ? 'Mark Unread' : 'Mark Read'}</span>
                </button>

                <button
                  onClick={() => handleDeleteEmailItem(emailViewerModal.id)}
                  className="px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30 flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </div>

              <button
                onClick={() => setEmailViewerModal(null)}
                className="px-5 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
