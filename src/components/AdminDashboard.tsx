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
  History,
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
  Target
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
              { id: 'finance', icon: Wallet, label: 'Treasury', badge: `₦${availableFees.toLocaleString()}` },
              { id: 'users', icon: Users, label: 'Gladiators', badge: usersList.length },
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
                          <div className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em] mt-0.5">Credited</div>
                        </td>
                      </tr>
                    ))}
                    {(!finance?.recent_fee_matches || finance.recent_fee_matches.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-10 py-20 text-center">
                          <div className="flex flex-col items-center gap-4 opacity-20">
                            <History size={64} className="text-neutral-500" />
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
