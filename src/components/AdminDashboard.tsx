import React, { useState, useEffect } from 'react';
import { UserProfile, WithdrawalRequest } from '../types';
import {
  ShieldCheck,
  ArrowDownCircle,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Copy,
  Check,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  AlertCircle,
  Send,
  Building2,
  CreditCard,
  User,
  Phone,
  Mail,
  Wallet,
  Sparkles,
  Zap,
  Smartphone,
  Radio,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import {
  fetchAdminWithdrawals,
  approveAdminWithdrawal,
  rejectAdminWithdrawal,
  fetchAdminUsers,
  assignUserRole,
  claimAdminRole,
  fetchAdminSmsAlerts,
  assignSmsAlertToUser,
  fetchAdminOpaySettings,
} from '../services/api';

interface AdminDashboardProps {
  currentUser: UserProfile;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'withdrawals' | 'admins' | 'finance' | 'opay_automation' | 'mailbox'>('withdrawals');
  const [finance, setFinance] = useState<{ total_fees_collected: number; total_fees_withdrawn: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Withdrawals state
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [processingWdId, setProcessingWdId] = useState<string | null>(null);

  // OPay Automation & MacroDroid state
  const [opayAlerts, setOpayAlerts] = useState<OpaySmsAlert[]>([]);
  const [opayAlertFilter, setOpayAlertFilter] = useState<'all' | 'unmatched' | 'auto_credited' | 'manually_credited'>('all');
  const [opaySettings, setOpaySettings] = useState<{
    webhookUrl: string;
    secretKey: string;
    accountDetails: { bankName: string; accountNumber: string; accountName: string };
    stats: { totalAlerts: number; autoCredited: number; unmatched: number; totalCreditedAmount: number };
  } | null>(null);
  const [testSmsText, setTestSmsText] = useState('');
  const [testSmsResult, setTestSmsResult] = useState<any | null>(null);
  const [isTestingSms, setIsTestingSms] = useState(false);

  // Mailbox state
  const [mailboxMessages, setMailboxMessages] = useState<any[]>([]);
  const [mailboxFolder, setMailboxFolder] = useState<'all' | 'inbox' | 'sent'>('inbox');
  const [selectedMail, setSelectedMail] = useState<any | null>(null);
  const [composeModal, setComposeModal] = useState<{
    isOpen: boolean;
    recipientEmail: string;
    subject: string;
    body: string;
  }>({
    isOpen: false,
    recipientEmail: '',
    subject: '',
    body: '',
  });
  const [isSendingMail, setIsSendingMail] = useState(false);
  const [isSimulatingMail, setIsSimulatingMail] = useState(false);
  const [mailMsg, setMailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedDnsKey, setCopiedDnsKey] = useState<string | null>(null);

  const handleCopyDns = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDnsKey(key);
    setTimeout(() => setCopiedDnsKey(null), 2000);
  };

  // Assign unmatched alert dialog
  const [assignAlertModal, setAssignAlertModal] = useState<{
    isOpen: boolean;
    alert: OpaySmsAlert | null;
    selectedUserId: string;
    isAssigning: boolean;
  }>({
    isOpen: false,
    alert: null,
    selectedUserId: '',
    isAssigning: false,
  });

  // OPay Payout Modal state
  const [opayModalData, setOpayModalData] = useState<{
    isOpen: boolean;
    withdrawal: WithdrawalRequest | null;
    opayWebUrl?: string;
    opayDeepLink?: string;
    androidIntent?: string;
    paymentData?: any;
    copied: boolean;
  }>({
    isOpen: false,
    withdrawal: null,
    copied: false,
  });

  // Users & Admin Assignment state
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [assignIdentifier, setAssignIdentifier] = useState('');
  const [assignRoleType, setAssignRoleType] = useState<'admin' | 'user'>('admin');
  const [assignMsg, setAssignMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isAssigning, setIsAssigning] = useState(false);

  // Passcode claim for unassigned admin
  const [adminPasscode, setAdminPasscode] = useState('');
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  // Load finance stats
  const loadFinance = async () => {
    try {
      const res = await fetch(`/api/admin/finance?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setFinance(data);
      }
    } catch (e) {
      console.error('Error loading finance stats:', e);
    }
  };

  // Load withdrawals
  const loadWithdrawals = async () => {
    try {
      const list = await fetchAdminWithdrawals(currentUser.id, withdrawalFilter);
      setWithdrawals(list);
    } catch (e) {
      console.error('Error loading withdrawals:', e);
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

  // Load OPay Settings & MacroDroid Alerts
  const loadOpayData = async () => {
    try {
      const [settings, alerts] = await Promise.all([
        fetchAdminOpaySettings(currentUser.id).catch(() => null),
        fetchAdminSmsAlerts(currentUser.id, opayAlertFilter).catch(() => []),
      ]);
      if (settings) setOpaySettings(settings);
      setOpayAlerts(alerts);
    } catch (e) {
      console.error('Error loading OPay alerts:', e);
    }
  };

  // Load Mailbox messages
  const loadMailbox = async () => {
    try {
      const res = await fetch(`/api/admin/mailbox?userId=${currentUser.id}&folder=${mailboxFolder}`);
      if (res.ok) {
        const data = await res.json();
        setMailboxMessages(data.messages || []);
      }
    } catch (e) {
      console.error('Error loading mailbox:', e);
    }
  };

  const handleSendMail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeModal.recipientEmail || !composeModal.subject || !composeModal.body) return;
    setIsSendingMail(true);
    setMailMsg(null);
    try {
      const res = await fetch('/api/admin/mailbox/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          recipientEmail: composeModal.recipientEmail,
          subject: composeModal.subject,
          body: composeModal.body,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send email');
      setMailMsg({ type: 'success', text: data.message });
      setComposeModal({ isOpen: false, recipientEmail: '', subject: '', body: '' });
      loadMailbox();
    } catch (err: any) {
      setMailMsg({ type: 'error', text: err.message });
    } finally {
      setIsSendingMail(false);
    }
  };

  const handleSimulateMail = async () => {
    setIsSimulatingMail(true);
    setMailMsg(null);
    try {
      const res = await fetch('/api/admin/mailbox/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to simulate email');
      setMailMsg({ type: 'success', text: data.message });
      loadMailbox();
    } catch (err: any) {
      setMailMsg({ type: 'error', text: err.message });
    } finally {
      setIsSimulatingMail(false);
    }
  };

  const reloadAll = async () => {
    setRefreshing(true);
    await Promise.all([loadFinance(), loadWithdrawals(), loadUsers(), loadOpayData(), loadMailbox()]);
    setRefreshing(false);
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      if (currentUser.role === 'admin') {
        await Promise.all([loadFinance(), loadWithdrawals(), loadUsers(), loadOpayData(), loadMailbox()]);
      }
      setLoading(false);
    };
    init();
  }, [currentUser.id, currentUser.role, withdrawalFilter, opayAlertFilter, mailboxFolder]);

  // Handle Testing SMS Simulator
  const handleRunTestSms = async (sampleText?: string) => {
    const textToTest = sampleText || testSmsText;
    if (!textToTest.trim()) return;
    setIsTestingSms(true);
    setTestSmsResult(null);
    try {
      const res = await fetch('/api/admin/opay/test-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, smsText: textToTest }),
      });
      const data = await res.json();
      setTestSmsResult(data);
    } catch (err: any) {
      alert(`Test error: ${err.message}`);
    } finally {
      setIsTestingSms(false);
    }
  };

  // Handle Assigning Unmatched SMS Alert to Player
  const handleAssignAlertToUser = async () => {
    if (!assignAlertModal.alert || !assignAlertModal.selectedUserId) return;
    setAssignAlertModal((prev) => ({ ...prev, isAssigning: true }));
    try {
      const res = await assignSmsAlertToUser(
        currentUser.id,
        assignAlertModal.alert.id,
        assignAlertModal.selectedUserId
      );
      alert(res.message || 'Alert successfully assigned to player!');
      setAssignAlertModal({ isOpen: false, alert: null, selectedUserId: '', isAssigning: false });
      loadOpayData();
      loadUsers();
    } catch (err: any) {
      alert(`Assignment failed: ${err.message}`);
      setAssignAlertModal((prev) => ({ ...prev, isAssigning: false }));
    }
  };

  // Handle Approve Withdrawal and Redirect to OPay
  const handleApproveWithdrawal = async (wd: WithdrawalRequest) => {
    if (processingWdId) return;
    setProcessingWdId(wd.id);

    try {
      const res = await approveAdminWithdrawal(currentUser.id, wd.id);

      // Pre-format clipboard payload so admin doesn't need to manually copy anything
      const clipText = `OPay Transfer:
Amount: ₦${wd.amount}
Recipient Bank: ${wd.bankName}
Account Number: ${wd.accountNumber}
Account Name: ${wd.accountName}
Narration/Remark: ${wd.remark}`;

      try {
        await navigator.clipboard.writeText(clipText);
      } catch (_) {}

      // Open OPay Modal with deep links and redirect options
      setOpayModalData({
        isOpen: true,
        withdrawal: wd,
        opayWebUrl: res.opayWebUrl,
        opayDeepLink: res.opayDeepLink,
        androidIntent: res.androidIntent,
        paymentData: res.paymentData,
        copied: true,
      });

      // Try automatically opening OPay in new tab or deep link
      if (res.opayWebUrl) {
        window.open(res.opayWebUrl, '_blank', 'noopener,noreferrer');
      }

      // Refresh list
      loadWithdrawals();
      loadFinance();
    } catch (err: any) {
      alert(`Approval error: ${err.message || 'Failed to approve withdrawal'}`);
    } finally {
      setProcessingWdId(null);
    }
  };

  // Handle Reject Withdrawal and Refund User
  const handleRejectWithdrawal = async (wd: WithdrawalRequest) => {
    const reason = prompt(
      `Reject withdrawal of ₦${wd.amount.toLocaleString()} for ${wd.codmIgn}?\nEnter reason (funds will be refunded to their wallet):`,
      'Bank details mismatch or invalid NUBAN'
    );
    if (reason === null) return; // user cancelled

    setProcessingWdId(wd.id);
    try {
      const res = await rejectAdminWithdrawal(currentUser.id, wd.id, reason);
      alert(res.message || 'Withdrawal rejected and funds refunded.');
      loadWithdrawals();
    } catch (err: any) {
      alert(`Reject error: ${err.message || 'Failed to reject withdrawal'}`);
    } finally {
      setProcessingWdId(null);
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
    const confirmMsg = targetUser.role === 'admin'
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

  const handleWithdrawPlatformFees = async () => {
    const amount = prompt('Enter platform rake amount (₦) to withdraw to admin wallet:');
    if (!amount) return;

    const res = await fetch('/api/admin/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, amount }),
    });

    if (res.ok) {
      alert('Platform rake withdrawal successful!');
      loadFinance();
    } else {
      const err = await res.json();
      alert(`Withdrawal failed: ${err.error || 'Unknown error'}`);
    }
  };

  // If current user is not marked as admin
  if (currentUser.role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-neutral-900 border border-neutral-800 rounded-2xl text-white space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black uppercase tracking-wider">Admin Verification Required</h2>
          <p className="text-sm text-neutral-400">
            Account <span className="text-amber-400 font-mono">{currentUser.email || currentUser.codmIgn}</span> does not have active Admin privileges.
          </p>
        </div>

        <form onSubmit={handleClaimAdmin} className="space-y-4 pt-4 border-t border-neutral-800">
          <label className="text-xs font-bold uppercase tracking-wider text-neutral-300 block">
            Enter Admin Security Key
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
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold uppercase tracking-wider rounded-xl transition cursor-pointer"
          >
            Verify Admin Access
          </button>
        </form>
      </div>
    );
  }

  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'pending').length;

  const filteredWithdrawals = withdrawals.filter((w) => {
    if (withdrawalFilter !== 'all' && w.status !== withdrawalFilter) return false;
    if (withdrawalSearch.trim()) {
      const q = withdrawalSearch.toLowerCase();
      return (
        w.codmIgn.toLowerCase().includes(q) ||
        w.accountNumber.includes(q) ||
        w.bankName.toLowerCase().includes(q) ||
        w.accountName.toLowerCase().includes(q) ||
        w.remark.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 text-white">
      {/* Top Banner */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
                Esports Admin Portal
              </h1>
              <span className="px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full">
                OPay Payout Ready
              </span>
            </div>
            <p className="text-xs sm:text-sm text-neutral-400">
              Welcome back, <span className="text-amber-400 font-bold">{currentUser.codmIgn}</span> ({currentUser.email}). Manage instant cashout payouts, user roles, and rake revenue.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={reloadAll}
              disabled={refreshing}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold rounded-xl flex items-center gap-2 border border-neutral-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Data
            </button>
          </div>
        </div>

        {/* Quick Nav Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-6 border-t border-neutral-800/80 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
              activeTab === 'withdrawals'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-lg shadow-amber-400/20'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/50'
            }`}
          >
            <Clock className="w-4 h-4" />
            Pending Withdrawals
            {pendingWithdrawalsCount > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-rose-500 text-white animate-pulse">
                {pendingWithdrawalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('admins')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
              activeTab === 'admins'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-lg shadow-amber-400/20'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/50'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            Assign Admin Users
          </button>

          <button
            onClick={() => setActiveTab('finance')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
              activeTab === 'finance'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-lg shadow-amber-400/20'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/50'
            }`}
          >
            <Wallet className="w-4 h-4" />
            Platform Finance & Rake
          </button>

          <button
            onClick={() => setActiveTab('opay_automation')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
              activeTab === 'opay_automation'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-lg shadow-amber-400/20'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/50'
            }`}
          >
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>OPay SMS Alerts & Deposits</span>
            {opaySettings?.stats?.unmatched ? (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-rose-500 text-white animate-pulse">
                {opaySettings.stats.unmatched} Unmatched
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block ml-1 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('mailbox')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 uppercase tracking-wider transition whitespace-nowrap cursor-pointer ${
              activeTab === 'mailbox'
                ? 'bg-amber-400 text-neutral-950 font-black shadow-lg shadow-amber-400/20'
                : 'bg-neutral-800/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700/50'
            }`}
          >
            <Mail className="w-4 h-4 text-cyan-400" />
            <span>Admin Mailbox (codstake@detailr.online)</span>
            {mailboxMessages.filter(m => !m.isRead).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[9px] font-black rounded-full bg-cyan-500 text-neutral-950 animate-pulse">
                {mailboxMessages.filter(m => !m.isRead).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* TAB 1: WITHDRAWALS */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-neutral-900 p-4 rounded-2xl border border-neutral-800">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              {(['pending', 'all', 'approved', 'rejected'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setWithdrawalFilter(filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition cursor-pointer ${
                    withdrawalFilter === filter
                      ? 'bg-neutral-700 text-amber-400 border border-neutral-600'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search user, account, or bank..."
                value={withdrawalSearch}
                onChange={(e) => setWithdrawalSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* List of Withdrawal Requests */}
          {filteredWithdrawals.length === 0 ? (
            <div className="p-12 text-center bg-neutral-900 border border-neutral-800 rounded-2xl space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto opacity-70" />
              <h3 className="text-lg font-bold">No {withdrawalFilter} withdrawals</h3>
              <p className="text-sm text-neutral-400 max-w-md mx-auto">
                {withdrawalFilter === 'pending'
                  ? 'Great job! All requested payouts have been approved or processed.'
                  : 'No withdrawal records match your current filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredWithdrawals.map((wd) => {
                const isPending = wd.status === 'pending';
                const isApproved = wd.status === 'approved';
                const isRejected = wd.status === 'rejected';

                return (
                  <div
                    key={wd.id}
                    className={`bg-neutral-900 border ${
                      isPending
                        ? 'border-amber-500/40 shadow-lg shadow-amber-500/5'
                        : isApproved
                        ? 'border-emerald-500/30'
                        : 'border-neutral-800 opacity-75'
                    } rounded-2xl p-5 transition space-y-4`}
                  >
                    {/* Header info */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-amber-400 font-bold">
                          {wd.codmIgn.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-white text-base">{wd.codmIgn}</span>
                            <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                              #{wd.id.slice(-6)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-neutral-400">
                            {wd.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {wd.email}
                              </span>
                            )}
                            {wd.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {wd.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status & Amount */}
                      <div className="flex items-center sm:text-right justify-between sm:justify-end gap-4">
                        <div>
                          <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight">
                            ₦{wd.amount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-neutral-500">
                            Requested {new Date(wd.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                            {new Date(wd.createdAt).toLocaleDateString()}
                          </div>
                        </div>

                        <div>
                          {isPending && (
                            <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                              <Clock className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                          {isApproved && (
                            <div className="flex flex-col items-end gap-1">
                              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                                <CheckCircle2 className="w-3 h-3" />
                                Approved & Paid
                              </span>
                              {(wd.webhookReceived || wd.balanceDeducted) && (
                                <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                                  Webhook Settled • Balance Deducted
                                </span>
                              )}
                            </div>
                          )}
                          {isRejected && (
                            <span className="px-3 py-1 bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs font-bold rounded-full uppercase tracking-wider flex items-center gap-1.5">
                              <XCircle className="w-3 h-3" />
                              Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bank Info Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800/80">
                      <div>
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-amber-400" />
                          Destination Bank
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5">{wd.bankName}</div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-amber-400" />
                          10-Digit NUBAN Account
                        </div>
                        <div className="text-sm font-mono font-bold text-emerald-400 mt-0.5 tracking-wider">
                          {wd.accountNumber}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                          <User className="w-3 h-3 text-amber-400" />
                          Verified Account Name
                        </div>
                        <div className="text-sm font-bold text-white mt-0.5 truncate">{wd.accountName}</div>
                      </div>
                    </div>

                    {/* Remark & Action Row */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-neutral-400 flex items-center gap-2 w-full sm:w-auto">
                        <span className="font-bold text-neutral-500 uppercase tracking-wider text-[10px]">
                          Remark:
                        </span>
                        <code className="bg-neutral-800 text-amber-300 px-2 py-0.5 rounded font-mono text-[11px]">
                          {wd.remark}
                        </code>
                      </div>

                      {/* Approval / Reject Buttons */}
                      <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        {isPending ? (
                          <>
                            <button
                              onClick={() => handleRejectWithdrawal(wd)}
                              disabled={processingWdId === wd.id}
                              className="px-3.5 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-rose-400 text-xs font-bold border border-rose-500/20 transition cursor-pointer"
                            >
                              Reject & Refund
                            </button>

                            <button
                              onClick={() => handleApproveWithdrawal(wd)}
                              disabled={processingWdId === wd.id}
                              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                            >
                              <Send className="w-4 h-4" />
                              {processingWdId === wd.id ? 'Redirecting...' : 'Approve & Pay via OPay'}
                            </button>
                          </>
                        ) : isApproved ? (
                          <button
                            onClick={() => {
                              const opayUrl = `https://www.opayweb.com/?amount=${wd.amount}&account=${wd.accountNumber}&bank=${encodeURIComponent(wd.bankName)}&name=${encodeURIComponent(wd.accountName)}&remark=${encodeURIComponent(wd.remark)}`;
                              window.open(opayUrl, '_blank');
                            }}
                            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Open in OPay Again
                          </button>
                        ) : (
                          <div className="text-xs text-rose-400 italic">
                            Reason: {wd.rejectionReason || 'Rejected by Admin'}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ASSIGN ADMIN USERS */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          {/* Fast Assign Box */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
                <UserCheck className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Assign Admin Role
                </h3>
                <p className="text-xs text-neutral-400">
                  Grant full administrative rights (withdrawal approvals, match dispute resolutions, finance) to any player.
                </p>
              </div>
            </div>

            <form onSubmit={handleAssignRoleSubmit} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                    User Gmail Address or CODM IGN *
                  </label>
                  <input
                    type="text"
                    value={assignIdentifier}
                    onChange={(e) => setAssignIdentifier(e.target.value)}
                    placeholder="e.g. Loganhayes09@gmail.com or Ghost_NG"
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400"
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
                    className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="admin">ADMIN (Full Access)</option>
                    <option value="user">USER (Standard Player)</option>
                  </select>
                </div>
              </div>

              {assignMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
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
                  className="px-6 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  {isAssigning ? 'Updating Role...' : 'Save Role Assignment'}
                </button>
              </div>
            </form>
          </div>

          {/* User Directory */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Registered Gladiators Directory
                </h3>
                <p className="text-xs text-neutral-400">
                  {usersList.length} total players registered in database
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter by email or IGN..."
                  value={usersSearch}
                  onChange={(e) => {
                    setUsersSearch(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadUsers();
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider text-neutral-400">
                    <th className="py-3 px-3">Player / IGN</th>
                    <th className="py-3 px-3">Email & Phone</th>
                    <th className="py-3 px-3">Locked NUBAN Bank</th>
                    <th className="py-3 px-3">Wallet</th>
                    <th className="py-3 px-3">Current Role</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60 font-sans">
                  {usersList.map((u) => {
                    const isAdmin = u.role === 'admin';
                    return (
                      <tr key={u.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-3 font-bold text-white">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-black text-amber-400">
                              {(u.codmIgn || u.username || 'U').slice(0, 1).toUpperCase()}
                            </span>
                            {u.codmIgn || u.username}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-neutral-300">
                          <div>{u.email || '—'}</div>
                          <div className="text-[11px] text-neutral-500">{u.phone || ''}</div>
                        </td>
                        <td className="py-3 px-3 text-neutral-300">
                          {u.accountNumber ? (
                            <div>
                              <span className="font-mono text-emerald-400 font-bold">{u.accountNumber}</span>
                              <div className="text-[10px] text-neutral-500 truncate max-w-[140px]">
                                {u.bankName} • {u.accountName}
                              </div>
                            </div>
                          ) : (
                            <span className="text-neutral-500 italic">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-amber-400">
                          ₦{(u.balance || 0).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          {isAdmin ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/40">
                              ADMIN
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-neutral-800 text-neutral-400 border border-neutral-700">
                              USER
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleToggleUserRole(u)}
                            className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                              isAdmin
                                ? 'bg-neutral-800 hover:bg-rose-500/20 text-rose-400 border border-neutral-700'
                                : 'bg-neutral-800 hover:bg-emerald-500/20 text-emerald-400 border border-neutral-700'
                            }`}
                          >
                            {isAdmin ? 'Revoke Admin' : 'Make Admin'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCE & RAKE */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-1">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Total Fees Collected (10% Rake)
              </div>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                ₦{Number(finance?.total_fees_collected || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-neutral-500">Platform earnings from completed matches</div>
            </div>

            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-1">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Total Fees Withdrawn
              </div>
              <div className="text-3xl font-black text-amber-400 font-mono">
                ₦{Number(finance?.total_fees_withdrawn || 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-neutral-500">Total rake paid out to admin account</div>
            </div>

            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-1">
              <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Available Platform Rake
              </div>
              <div className="text-3xl font-black text-white font-mono">
                ₦{Math.max(
                  0,
                  Number(finance?.total_fees_collected || 0) - Number(finance?.total_fees_withdrawn || 0)
                ).toLocaleString()}
              </div>
              <div className="text-[11px] text-neutral-500">Ready to be cashed out</div>
            </div>
          </div>

          <button
            onClick={handleWithdrawPlatformFees}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black uppercase tracking-wider text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <ArrowDownCircle className="w-5 h-5" />
            Withdraw Platform Fees to Admin Wallet
          </button>
        </div>
      )}

      {/* TAB 4: OPAY & MACRODROID AUTOMATION */}
      {activeTab === 'opay_automation' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Status HUD / KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider">
                <span>Webhook Engine</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                </span>
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {opaySettings?.stats?.totalAlerts ?? 0}
              </div>
              <div className="text-[11px] text-neutral-500">Total SMS alerts processed</div>
            </div>

            <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-1">
              <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Auto-Credited
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {opaySettings?.stats?.autoCredited ?? 0}
              </div>
              <div className="text-[11px] text-neutral-500">Credited automatically via SMS</div>
            </div>

            <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl space-y-1">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Total Value Credited
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                ₦{(opaySettings?.stats?.totalCreditedAmount ?? 0).toLocaleString()}
              </div>
              <div className="text-[11px] text-neutral-500">Total volume funded via OPay</div>
            </div>

            <div className={`p-5 rounded-2xl border space-y-1 ${
              (opaySettings?.stats?.unmatched ?? 0) > 0 
                ? 'bg-rose-500/10 border-rose-500/30' 
                : 'bg-neutral-900 border-neutral-800'
            }`}>
              <div className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Unmatched Alerts
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {opaySettings?.stats?.unmatched ?? 0}
              </div>
              <div className="text-[11px] text-neutral-500">Needs 1-click player assignment</div>
            </div>
          </div>

          {/* SMS Parser & Simulator Section (Full Width) */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider font-heading">
                      OPay SMS Parser & Simulator
                    </h3>
                    <p className="text-[11px] text-neutral-400">
                      Test regex parsing and auto-crediting logic with sample SMS alerts
                    </p>
                  </div>
                </div>
              </div>

              {/* Sample Templates */}
              <div className="space-y-2">
                <span className="text-[11px] font-mono uppercase text-neutral-400 block">
                  Quick Sample Templates (Click to fill):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const txt = 'Your OPay account (7079874999) has been credited with NGN 1,000.00 from JOHN DOE / GTBANK. Ref: 102938475612. Remark: OP-4821. Bal: NGN 25,000.00';
                      setTestSmsText(txt);
                      handleRunTestSms(txt);
                    }}
                    className="p-2 text-left bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-[11px] transition cursor-pointer"
                  >
                    <span className="font-bold text-white block">₦1,000 + Ref</span>
                    <span className="text-neutral-500 text-[10px] truncate block">Standard OPay SMS</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const txt = 'Credit: NGN 5,000.00 from IBRAHIM SANI / KUDA to 7079874999. Ref: 202410159988. Desc: GHOST_NG. Bal: NGN 30,000.00';
                      setTestSmsText(txt);
                      handleRunTestSms(txt);
                    }}
                    className="p-2 text-left bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-[11px] transition cursor-pointer"
                  >
                    <span className="font-bold text-white block">₦5,000 + IGN</span>
                    <span className="text-neutral-500 text-[10px] truncate block">Desc with CODM IGN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const txt = 'Received ₦2,500.00 from EMMANUEL CHUKWU. Txn ID: 9948271. Note: EZ-8392. Current Balance: ₦15,000.00';
                      setTestSmsText(txt);
                      handleRunTestSms(txt);
                    }}
                    className="p-2 text-left bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-[11px] transition cursor-pointer"
                  >
                    <span className="font-bold text-white block">₦2,500 Direct</span>
                    <span className="text-neutral-500 text-[10px] truncate block">Short App Alert</span>
                  </button>
                </div>
              </div>

              {/* SMS Input Box */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase text-neutral-400 block">
                  OPay SMS Text to Test:
                </label>
                <textarea
                  rows={4}
                  value={testSmsText}
                  onChange={(e) => setTestSmsText(e.target.value)}
                  placeholder="Paste real SMS received from OPay on your phone..."
                  className="w-full p-3 bg-neutral-950 border border-neutral-800 rounded-xl text-xs font-mono text-white outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => handleRunTestSms()}
                  disabled={isTestingSms || !testSmsText.trim()}
                  className="w-full py-3 bg-amber-400 hover:bg-amber-300 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
                >
                  <Terminal className="w-4 h-4" />
                  {isTestingSms ? 'Testing Regex...' : 'Test Regex Parsing & Match Simulation'}
                </button>
              </div>

              {/* Test Result Inspector */}
              {testSmsResult && (
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2.5 animate-in fade-in text-xs font-mono">
                  <div className="text-[11px] uppercase font-bold text-amber-400 border-b border-neutral-900 pb-1">
                    Parsed Fields Output:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-neutral-500 block">Extracted Amount:</span>
                      <span className="text-emerald-400 font-bold text-sm">
                        {testSmsResult.parsed?.amount ? `₦${Number(testSmsResult.parsed.amount).toLocaleString()}` : 'Not Detected'}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Reference / Session:</span>
                      <span className="text-white font-bold">{testSmsResult.parsed?.reference || 'None'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Sender Name:</span>
                      <span className="text-white">{testSmsResult.parsed?.senderName || 'Unknown'}</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Remark / Narration:</span>
                      <span className="text-amber-300 font-bold">{testSmsResult.parsed?.narration || 'None'}</span>
                    </div>
                  </div>
                  {testSmsResult.execution && (
                    <div className="mt-2 pt-2 border-t border-neutral-900 text-emerald-400">
                      <strong>Execution Match:</strong> {testSmsResult.execution.message}
                    </div>
                  )}
                </div>
              )}
            </div>

          {/* SMS Alerts Table Section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider font-heading flex items-center gap-2">
                  <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                  Live OPay SMS Alerts Stream
                </h3>
                <p className="text-xs text-neutral-400">
                  Real-time history of SMS alerts captured by MacroDroid from your Android phone
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {(['all', 'unmatched', 'auto_credited', 'manually_credited'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setOpayAlertFilter(filter)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition whitespace-nowrap cursor-pointer ${
                      opayAlertFilter === filter
                        ? 'bg-amber-400 text-neutral-950 font-black'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {filter === 'all' ? 'All Alerts' : filter.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Alerts Table */}
            {opayAlerts.length === 0 ? (
              <div className="text-center py-12 bg-neutral-950/60 rounded-xl border border-neutral-800/80 space-y-3">
                <Smartphone className="w-12 h-12 text-neutral-600 mx-auto animate-bounce" />
                <h4 className="text-sm font-bold text-white uppercase">No SMS Alerts Recorded Yet</h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  Once your Android phone receives an OPay credit SMS, MacroDroid will trigger the webhook and appear here in real-time. You can also use the tester above to simulate an alert!
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400 uppercase font-mono">
                      <th className="py-3 px-3">Date / Time</th>
                      <th className="py-3 px-3">Amount</th>
                      <th className="py-3 px-3">Sender & Narration</th>
                      <th className="py-3 px-3">Reference</th>
                      <th className="py-3 px-3">Matched Player</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 font-sans">
                    {opayAlerts.map((alert) => (
                      <tr key={alert.id} className="hover:bg-neutral-800/30 transition">
                        <td className="py-3 px-3 text-neutral-400 font-mono text-[11px] whitespace-nowrap">
                          {new Date(alert.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-black text-emerald-400 text-sm">
                            +₦{alert.amount.toLocaleString()}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-white">{alert.senderName || 'OPay Transfer'}</div>
                          <div className="text-[11px] text-neutral-400 font-mono truncate max-w-xs">
                            {alert.narration || alert.smsBody}
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-neutral-300">
                          {alert.reference || '-'}
                        </td>
                        <td className="py-3 px-3">
                          {alert.matchedUserIgn ? (
                            <span className="px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 font-bold font-mono text-[11px] border border-amber-400/20">
                              {alert.matchedUserIgn}
                            </span>
                          ) : (
                            <span className="text-neutral-500 font-mono text-[11px]">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {alert.status === 'auto_credited' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              ⚡ Auto-Credited
                            </span>
                          )}
                          {alert.status === 'manually_credited' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              🛡️ Manual Assigned
                            </span>
                          )}
                          {alert.status === 'unmatched' && (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                              ⚠️ Unmatched
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {alert.status === 'unmatched' && (
                            <button
                              onClick={() => {
                                setAssignAlertModal({
                                  isOpen: true,
                                  alert,
                                  selectedUserId: usersList[0]?.id || '',
                                  isAssigning: false,
                                });
                              }}
                              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-lg text-xs uppercase tracking-wider transition cursor-pointer shadow"
                            >
                              Assign Player
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: ADMIN MAILBOX (codstake@detailr.online) */}
      {activeTab === 'mailbox' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Hostinger DNS Setup Guide Card */}
          <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-cyan-950/40 border border-cyan-500/30 rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-full font-mono">
                    Hostinger Domain Mail Setup
                  </span>
                  <span className="text-xs text-neutral-400 font-mono">codstake@detailr.online</span>
                </div>
                <h3 className="text-lg font-black text-white font-heading">
                  How to Receive Mail on Hostinger for detailr.online
                </h3>
                <p className="text-xs text-neutral-300 max-w-2xl">
                  To receive emails sent to <strong className="text-cyan-400 font-mono">codstake@detailr.online</strong> in this Admin Dashboard, configure your DNS records in Hostinger (where you purchased <span className="text-amber-400">detailr.online</span>).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setComposeModal({ isOpen: true, recipientEmail: '', subject: '', body: '' })}
                  className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Compose Email
                </button>
                <button
                  onClick={handleSimulateMail}
                  disabled={isSimulatingMail}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 font-bold text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition border border-cyan-500/30 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSimulatingMail ? 'animate-spin' : ''}`} />
                  Simulate Test Mail
                </button>
              </div>
            </div>

            {/* Hostinger & Resend DNS Records Complete Guide */}
            <div className="bg-neutral-950/80 rounded-2xl p-5 border border-cyan-500/20 space-y-5">
              {/* Inbound Webhook URL Card (Resend / Hostinger style) */}
              <div className="bg-gradient-to-r from-cyan-950/60 to-neutral-900 border border-cyan-500/40 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
                    <h4 className="text-xs font-black text-cyan-300 uppercase tracking-wider font-heading">
                      Inbound Mail Webhook URL (Like Resend Platform)
                    </h4>
                  </div>
                  <button
                    onClick={() => handleCopyDns('https://codm-new.onrender.com/api/inbound-mail', 'webhook_url')}
                    className="text-[11px] bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold px-3 py-1.5 rounded-lg font-mono transition flex items-center gap-1.5 cursor-pointer shadow"
                  >
                    {copiedDnsKey === 'webhook_url' ? '✅ Copied Webhook URL!' : '📋 Copy Webhook URL'}
                  </button>
                </div>
                <p className="text-xs text-neutral-300">
                  Paste this Render production endpoint URL into your Hostinger Agentic Mail or inbound forwarding settings so that any email sent to <strong className="text-cyan-400 font-mono">codstake@detailr.online</strong> is automatically posted and received here in your Admin Dashboard:
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex-1 p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg font-mono text-[11px] text-cyan-300 select-all truncate w-full">
                    https://codm-new.onrender.com/api/inbound-mail
                  </div>
                  <button
                    onClick={handleSimulateMail}
                    disabled={isSimulatingMail}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-lg transition shrink-0 cursor-pointer flex items-center gap-1.5 shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isSimulatingMail ? 'Testing...' : '🧪 Test & Verify Inbound'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                    Complete DNS Records for detailr.online (Hostinger Mail & Resend):
                  </h4>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Configure these records in your Hostinger hPanel DNS Zone Editor. Set TTL to <code className="text-cyan-300 font-mono">14400 (4 Hours)</code> or <code className="text-cyan-300 font-mono">3600 (1 Hour)</code>.
                  </p>
                </div>
                <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-mono whitespace-nowrap">
                  ⚠️ MX routing requires deleting old conflicting MX records first
                </span>
              </div>

              {/* Section 1: Hostinger Mail MX & TXT */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2 text-cyan-300">
                  <span>📬 1. Hostinger Mail MX & SPF Records (For Receiving Mail at codstake@detailr.online)</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* MX Record 1 */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">MX Record (Primary)</span>
                      <button
                        onClick={() => handleCopyDns('mx1.hostinger.com', 'mx1')}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-cyan-300 px-2 py-1 rounded font-mono transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedDnsKey === 'mx1' ? '✅ Copied!' : '📋 Copy Target'}
                      </button>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-300">
                      <div><span className="text-neutral-500">Type:</span> <strong className="text-white">MX</strong></div>
                      <div><span className="text-neutral-500">Host/Name:</span> <strong className="text-white">@</strong></div>
                      <div><span className="text-neutral-500">Target/Value:</span> <strong className="text-cyan-400 select-all">mx1.hostinger.com</strong></div>
                      <div><span className="text-neutral-500">Priority:</span> <strong className="text-amber-400">5</strong> | <span className="text-neutral-500">TTL:</span> <strong className="text-neutral-200">14400</strong></div>
                    </div>
                  </div>

                  {/* MX Record 2 */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">MX Record (Secondary)</span>
                      <button
                        onClick={() => handleCopyDns('mx2.hostinger.com', 'mx2')}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-cyan-300 px-2 py-1 rounded font-mono transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedDnsKey === 'mx2' ? '✅ Copied!' : '📋 Copy Target'}
                      </button>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-300">
                      <div><span className="text-neutral-500">Type:</span> <strong className="text-white">MX</strong></div>
                      <div><span className="text-neutral-500">Host/Name:</span> <strong className="text-white">@</strong></div>
                      <div><span className="text-neutral-500">Target/Value:</span> <strong className="text-cyan-400 select-all">mx2.hostinger.com</strong></div>
                      <div><span className="text-neutral-500">Priority:</span> <strong className="text-amber-400">10</strong> | <span className="text-neutral-500">TTL:</span> <strong className="text-neutral-200">14400</strong></div>
                    </div>
                  </div>

                  {/* SPF Record */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">TXT Record (SPF)</span>
                      <button
                        onClick={() => handleCopyDns('v=spf1 include:_spf.mail.hostinger.com ~all', 'spf')}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-cyan-300 px-2 py-1 rounded font-mono transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedDnsKey === 'spf' ? '✅ Copied!' : '📋 Copy Value'}
                      </button>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-300">
                      <div><span className="text-neutral-500">Host/Name:</span> <strong className="text-white">@</strong></div>
                      <div><span className="text-neutral-500">Value:</span> <strong className="text-neutral-200 select-all text-[11px] block truncate">v=spf1 include:_spf.mail.hostinger.com ~all</strong></div>
                      <div><span className="text-neutral-500">TTL:</span> <strong className="text-neutral-200">14400</strong></div>
                    </div>
                  </div>

                  {/* DKIM Record */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-bold">TXT Record (DKIM)</span>
                      <button
                        onClick={() => handleCopyDns('default._domainkey', 'dkim_name')}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-cyan-300 px-2 py-1 rounded font-mono transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedDnsKey === 'dkim_name' ? '✅ Copied Name!' : '📋 Copy Name'}
                      </button>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-300">
                      <div><span className="text-neutral-500">Host/Name:</span> <strong className="text-cyan-300 select-all">default._domainkey</strong> <span className="text-[10px] text-neutral-400">(or hostinger._domainkey)</span></div>
                      <div><span className="text-neutral-500">Value:</span> <span className="text-neutral-400 text-[10px]">Check Hostinger hPanel Email Settings for your exact key</span></div>
                      <div><span className="text-neutral-500">TTL:</span> <strong className="text-neutral-200">14400</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Resend DNS Records (Old/Transactional Info) */}
              <div className="space-y-3 pt-3 border-t border-neutral-900">
                <div className="text-[11px] font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2 text-emerald-400">
                  <span>⚡ 2. Resend Domain DNS Records (For Sending Platform Notifications / Verification)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Resend DKIM */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Resend TXT (DKIM)</span>
                      <button
                        onClick={() => handleCopyDns('resend._domainkey', 'resend_name')}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-emerald-300 px-2 py-1 rounded font-mono transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedDnsKey === 'resend_name' ? '✅ Copied Name!' : '📋 Copy Name'}
                      </button>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-300">
                      <div><span className="text-neutral-500">Host/Name:</span> <strong className="text-emerald-400 select-all">resend._domainkey</strong></div>
                      <div><span className="text-neutral-500">Value:</span> <span className="text-neutral-400 text-[10px]">From your Resend Dashboard</span></div>
                      <div><span className="text-neutral-500">TTL:</span> <strong className="text-neutral-200">14400</strong></div>
                    </div>
                  </div>

                  {/* Resend Bounces/Send */}
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold">Resend MX / CNAME</span>
                      <button
                        onClick={() => handleCopyDns('feedback-smtp.us-east-1.amazonses.com', 'resend_target')}
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-emerald-300 px-2 py-1 rounded font-mono transition flex items-center gap-1 cursor-pointer"
                      >
                        {copiedDnsKey === 'resend_target' ? '✅ Copied Target!' : '📋 Copy Target'}
                      </button>
                    </div>
                    <div className="text-xs space-y-1 font-mono text-neutral-300">
                      <div><span className="text-neutral-500">Host/Name:</span> <strong className="text-white">bounces / send</strong></div>
                      <div><span className="text-neutral-500">Target:</span> <strong className="text-emerald-300 select-all text-[11px]">feedback-smtp.us-east-1.amazonses.com</strong></div>
                      <div><span className="text-neutral-500">Priority:</span> <strong className="text-amber-400">10</strong> | <span className="text-neutral-500">TTL:</span> <strong className="text-neutral-200">14400</strong></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Troubleshooting Checklist */}
              <div className="bg-neutral-900/90 rounded-xl p-4 border border-cyan-500/30 space-y-3 text-xs text-neutral-300">
                <div className="font-bold text-white uppercase text-[11px] font-heading flex items-center gap-1.5 text-cyan-400">
                  <span>💡</span> Why isn't mail sent from Gmail arriving here yet? (And how to fix it):
                </div>
                <div className="space-y-2 text-neutral-300 text-xs">
                  <p>
                    When you send an email from Gmail to <code className="text-cyan-300 font-mono">codstake@detailr.online</code>, Google checks your domain's MX records. Because your MX records point to Hostinger, <strong className="text-white">Hostinger receives the email in your Hostinger Titan Webmail inbox</strong>.
                  </p>
                  <p>
                    For that email to appear in <strong className="text-white">this Admin Dashboard</strong>, you need to tell Hostinger to forward incoming emails to our Webhook URL:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-400 pl-2">
                    <li>Log in to your <strong className="text-white">Hostinger hPanel</strong> &gt; <strong className="text-white">Emails</strong> &gt; <strong className="text-white">Forwarders</strong> (or Agentic Mail).</li>
                    <li>Create a forwarder for <strong className="text-cyan-300 font-mono">codstake@detailr.online</strong> to forward incoming messages, OR paste your Inbound Webhook URL into Hostinger's webhook settings.</li>
                    <li>Alternatively, log in to Hostinger Webmail at <code className="text-cyan-300 font-mono">mail.hostinger.com</code> to view emails received at <code className="text-cyan-300 font-mono">codstake@detailr.online</code>!</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          {/* Mailbox Inbox Container */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider font-heading flex items-center gap-2">
                  <Mail className="w-5 h-5 text-cyan-400" />
                  Mailbox: codstake@detailr.online
                </h3>
                <p className="text-xs text-neutral-400">
                  View, read, and reply to all emails received at your domain inbox
                </p>
              </div>

              {/* Folder Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {(['inbox', 'sent', 'all'] as const).map((folder) => (
                  <button
                    key={folder}
                    onClick={() => setMailboxFolder(folder)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition whitespace-nowrap cursor-pointer ${
                      mailboxFolder === folder
                        ? 'bg-cyan-400 text-neutral-950 font-black'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
                    }`}
                  >
                    {folder}
                  </button>
                ))}
              </div>
            </div>

            {mailMsg && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                mailMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {mailMsg.text}
              </div>
            )}

            {mailboxMessages.length === 0 ? (
              <div className="text-center py-12 bg-neutral-950/60 rounded-xl border border-neutral-800/80 space-y-3">
                <Mail className="w-12 h-12 text-neutral-600 mx-auto animate-pulse" />
                <h4 className="text-sm font-bold text-white uppercase">Your Mailbox is Empty</h4>
                <p className="text-xs text-neutral-400 max-w-md mx-auto">
                  No emails found in this folder. Click <span className="text-cyan-400 font-bold">Simulate Test Mail</span> above to test receiving an email instantly!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/80 bg-neutral-950/50 rounded-xl border border-neutral-800 overflow-hidden">
                {mailboxMessages.map((mail) => (
                  <div
                    key={mail.id}
                    onClick={() => setSelectedMail(mail)}
                    className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-neutral-800/50 transition cursor-pointer ${
                      !mail.isRead ? 'bg-cyan-500/5 font-semibold' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${!mail.isRead ? 'bg-cyan-400 animate-pulse' : 'bg-transparent'}`} />
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-bold">{mail.senderName || mail.senderEmail}</span>
                          <span className="text-neutral-500 text-[11px] font-mono">&lt;{mail.senderEmail}&gt;</span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase ${
                            mail.folder === 'sent' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          }`}>
                            {mail.folder}
                          </span>
                        </div>
                        <div className="text-xs text-neutral-200 font-bold">{mail.subject}</div>
                        <div className="text-xs text-neutral-400 truncate max-w-xl">{mail.body}</div>
                      </div>
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono whitespace-nowrap self-end sm:self-center">
                      {new Date(mail.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: View Mail & Reply */}
      {selectedMail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-cyan-500/40 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-cyan-400 font-mono">
                  {selectedMail.folder === 'sent' ? 'Sent Email' : 'Incoming Inbox Mail'}
                </span>
                <h3 className="text-base font-black text-white font-heading">{selectedMail.subject}</h3>
              </div>
              <button
                onClick={() => setSelectedMail(null)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-neutral-400">From:</span>
                <span className="text-white font-bold">{selectedMail.senderName} &lt;{selectedMail.senderEmail}&gt;</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">To:</span>
                <span className="text-cyan-400">{selectedMail.recipientEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Date:</span>
                <span className="text-neutral-300">{new Date(selectedMail.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 text-xs text-neutral-200 font-sans whitespace-pre-line min-h-[120px]">
              {selectedMail.body}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  const sender = selectedMail.senderEmail;
                  setSelectedMail(null);
                  setComposeModal({
                    isOpen: true,
                    recipientEmail: sender,
                    subject: `Re: ${selectedMail.subject}`,
                    body: `\n\n--- Original Message ---\nFrom: ${selectedMail.senderEmail}\nSubject: ${selectedMail.subject}\n${selectedMail.body}`,
                  });
                }}
                className="px-4 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
                Reply to Sender
              </button>
              <button
                onClick={() => setSelectedMail(null)}
                className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Compose / Reply Email */}
      {composeModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-cyan-500/40 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black uppercase text-white font-heading flex items-center gap-2">
                <Send className="w-4 h-4 text-cyan-400" />
                Compose Mail from codstake@detailr.online
              </h3>
              <button
                onClick={() => setComposeModal({ isOpen: false, recipientEmail: '', subject: '', body: '' })}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendMail} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-neutral-300 block">Recipient Email:</label>
                <input
                  type="email"
                  required
                  placeholder="player@gmail.com"
                  value={composeModal.recipientEmail}
                  onChange={(e) => setComposeModal(prev => ({ ...prev, recipientEmail: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-neutral-300 block">Subject:</label>
                <input
                  type="text"
                  required
                  placeholder="Deposit Verification / Support Update"
                  value={composeModal.subject}
                  onChange={(e) => setComposeModal(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-neutral-300 block">Message Body:</label>
                <textarea
                  required
                  rows={6}
                  placeholder="Type your reply or support message here..."
                  value={composeModal.body}
                  onChange={(e) => setComposeModal(prev => ({ ...prev, body: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono outline-none focus:border-cyan-400 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setComposeModal({ isOpen: false, recipientEmail: '', subject: '', body: '' })}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingMail}
                  className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center gap-2 transition shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  <Send className={`w-4 h-4 ${isSendingMail ? 'animate-bounce' : ''}`} />
                  {isSendingMail ? 'Sending...' : 'Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Unmatched Alert to Player */}
      {assignAlertModal.isOpen && assignAlertModal.alert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-emerald-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-white animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-base font-black uppercase text-white font-heading">
                Assign Alert to Player
              </h3>
              <button
                onClick={() => setAssignAlertModal({ isOpen: false, alert: null, selectedUserId: '', isAssigning: false })}
                className="p-1 rounded-lg text-neutral-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-neutral-950 rounded-2xl border border-neutral-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-neutral-400">Credit Amount:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  +₦{assignAlertModal.alert.amount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Sender / Remark:</span>
                <span className="text-white truncate max-w-[200px]">
                  {assignAlertModal.alert.narration || assignAlertModal.alert.senderName || 'OPay Transfer'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Ref:</span>
                <span className="text-neutral-300">{assignAlertModal.alert.reference || '-'}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase text-neutral-300 block">
                Select Player to Credit:
              </label>
              <select
                value={assignAlertModal.selectedUserId}
                onChange={(e) => setAssignAlertModal((prev) => ({ ...prev, selectedUserId: e.target.value }))}
                className="w-full px-3 py-2.5 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs font-mono outline-none focus:border-amber-400"
              >
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.codmIgn || u.username} ({u.email}) - Bal: ₦{u.balance.toLocaleString()}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAssignAlertModal({ isOpen: false, alert: null, selectedUserId: '', isAssigning: false })}
                className="w-1/2 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded-xl text-xs uppercase"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssignAlertToUser}
                disabled={assignAlertModal.isAssigning || !assignAlertModal.selectedUserId}
                className="w-1/2 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {assignAlertModal.isAssigning ? 'Crediting...' : 'Confirm & Credit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPay Payout Modal / Redirect Sheet */}
      {opayModalData.isOpen && opayModalData.withdrawal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-emerald-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6 text-white animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400">
                  <CheckCircle2 className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-white">
                    Approved & Launching OPay
                  </h3>
                  <p className="text-xs text-neutral-400">
                    Payment details have been pre-filled and copied to clipboard!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpayModalData((prev) => ({ ...prev, isOpen: false }))}
                className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Webhook Instant Deduction Banner */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold animate-in fade-in">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
              <div>
                <span className="text-white font-extrabold uppercase tracking-wider block text-[11px]">
                  System Webhook Dispatched
                </span>
                <span>
                  ₦{opayModalData.withdrawal.amount.toLocaleString()} was deducted instantly from {opayModalData.withdrawal.codmIgn}&apos;s wallet balance in the system.
                </span>
              </div>
            </div>

            {/* Transfer Payload Card */}
            <div className="space-y-3 bg-neutral-950/80 p-4 rounded-2xl border border-neutral-800 font-sans">
              <div className="flex items-center justify-between border-b border-neutral-800/60 pb-2">
                <span className="text-xs text-neutral-400">Transfer Amount</span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  ₦{opayModalData.withdrawal.amount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs border-b border-neutral-800/60 pb-2">
                <span className="text-neutral-400">Recipient Bank</span>
                <span className="font-bold text-white">{opayModalData.withdrawal.bankName}</span>
              </div>

              <div className="flex items-center justify-between text-xs border-b border-neutral-800/60 pb-2">
                <span className="text-neutral-400">Account Number (NUBAN)</span>
                <span className="font-mono font-bold text-emerald-400 tracking-wider text-sm">
                  {opayModalData.withdrawal.accountNumber}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs border-b border-neutral-800/60 pb-2">
                <span className="text-neutral-400">Auto-Resolved Name</span>
                <span className="font-bold text-white">{opayModalData.withdrawal.accountName}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Narration / Remark</span>
                <span className="font-mono font-bold text-amber-300">
                  {opayModalData.withdrawal.remark}
                </span>
              </div>
            </div>

            {/* Direct Redirect Action Buttons */}
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {opayModalData.opayWebUrl && (
                  <a
                    href={opayModalData.opayWebUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 transition"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open in OPay Web
                  </a>
                )}

                {opayModalData.opayDeepLink && (
                  <a
                    href={opayModalData.opayDeepLink}
                    className="py-3 px-4 bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 border border-neutral-700 transition"
                  >
                    <Send className="w-4 h-4 text-emerald-400" />
                    Open OPay App (Mobile)
                  </a>
                )}
              </div>

              <button
                onClick={async () => {
                  const clip = `OPay Transfer:
Amount: ₦${opayModalData.withdrawal?.amount}
Bank: ${opayModalData.withdrawal?.bankName}
Account Number: ${opayModalData.withdrawal?.accountNumber}
Account Name: ${opayModalData.withdrawal?.accountName}
Narration: ${opayModalData.withdrawal?.remark}`;
                  await navigator.clipboard.writeText(clip);
                  setOpayModalData((prev) => ({ ...prev, copied: true }));
                }}
                className="w-full py-2.5 bg-neutral-800/80 hover:bg-neutral-800 text-xs text-neutral-300 font-bold rounded-xl flex items-center justify-center gap-2 border border-neutral-700 transition cursor-pointer"
              >
                {opayModalData.copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    Details Copied to Clipboard
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Transfer Info
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
