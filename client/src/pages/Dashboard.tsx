import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { BarChart3 } from 'lucide-react';
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
    <div className="p-4 sm:p-8 max-w-[1400px]">
      <header className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-slate-700 shadow-sm">
              <BarChart3 size={22} strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Warehouse Operations
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                Operations Dashboard
              </h1>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600">
                Executive summary of purchase order fulfillment, shipment order progress, and
                outbound packing performance.
              </p>
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-right sm:min-w-[180px]">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Report date
            </div>
            <div className="mt-1 text-sm font-medium tabular-nums text-slate-800">{today}</div>
            {user && (
              <div className="mt-2 text-xs text-slate-500">
                Signed in as <span className="font-medium text-slate-700">{user.username}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mt-8">
        {loading && (
          <div className="rounded-lg border border-slate-200 bg-white px-6 py-20 text-center">
            <p className="text-sm font-medium text-slate-600">Retrieving operational metrics…</p>
            <p className="mt-1 text-xs text-slate-400">Please wait while data is compiled.</p>
          </div>
        )}
        {!loading && stats && user && <DashboardPanel stats={stats} role={user.role} />}
      </div>
    </div>
  );
}
