import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { DashboardPanel } from '../components/DashboardPanel';
import { useAuth } from '../context/AuthContext';
import type { DashboardStats } from '../types';
import { formatDate } from '../utils/date';

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ stats: DashboardStats }>('/api/dashboard')
      .then((d) => setStats(d.stats))
      .catch((err: Error) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  const today = formatDate(new Date());

  return (
    <div className="min-h-full w-full min-w-0 max-w-full bg-[#f8f9fb] p-4 sm:p-8">
      <div className="mx-auto w-full min-w-0 max-w-[1400px]">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Operations Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Purchase order fulfillment, shipment progress, and packing performance.
            </p>
          </div>
          <div className="rounded-2xl bg-white px-5 py-3 text-sm shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <div className="text-xs text-slate-400">Report date</div>
            <div className="mt-0.5 font-semibold tabular-nums text-slate-800">{today}</div>
            {user && <div className="mt-1 text-xs text-slate-500">{user.username}</div>}
          </div>
        </header>

        {loading && (
          <div className="rounded-2xl bg-white px-6 py-20 text-center shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <p className="text-sm font-medium text-slate-600">Retrieving operational metrics…</p>
            <p className="mt-1 text-xs text-slate-400">Please wait while data is compiled.</p>
          </div>
        )}
        {!loading && stats && user && <DashboardPanel stats={stats} role={user.role} />}
      </div>
    </div>
  );
}
