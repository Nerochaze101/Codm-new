import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { ShieldCheck, ArrowDownCircle } from 'lucide-react';

interface AdminDashboardProps {
  currentUser: UserProfile;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser }) => {
  const [finance, setFinance] = useState<{ total_fees_collected: number; total_fees_withdrawn: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/finance?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        setFinance(data);
        setLoading(false);
      });
  }, [currentUser.id]);

  const handleWithdraw = async () => {
    const amount = prompt('Enter amount to withdraw:');
    if (!amount) return;

    const res = await fetch('/api/admin/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, amount }),
    });

    if (res.ok) {
      alert('Withdrawal successful');
      // Refresh
      const financeRes = await fetch(`/api/admin/finance?userId=${currentUser.id}`);
      setFinance(await financeRes.json());
    } else {
      alert('Withdrawal failed');
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!finance) return <div>Failed to load</div>;

  return (
    <div className="p-6 bg-neutral-900 rounded-2xl text-white space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <ShieldCheck className="text-amber-400" />
        Admin Dashboard
      </h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-neutral-800 rounded-xl">
          <div className="text-sm text-neutral-400">Total Fees Collected</div>
          <div className="text-2xl font-bold text-emerald-400">₦{Number(finance.total_fees_collected).toLocaleString()}</div>
        </div>
        <div className="p-4 bg-neutral-800 rounded-xl">
          <div className="text-sm text-neutral-400">Total Fees Withdrawn</div>
          <div className="text-2xl font-bold text-amber-400">₦{Number(finance.total_fees_withdrawn).toLocaleString()}</div>
        </div>
      </div>
      <button
        onClick={handleWithdraw}
        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-xl flex items-center justify-center gap-2"
      >
        <ArrowDownCircle />
        Withdraw Fees
      </button>
    </div>
  );
};
