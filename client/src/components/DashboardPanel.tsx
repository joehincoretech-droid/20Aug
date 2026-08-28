import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  ClipboardList,
  FileText,
  History,
  Layers,
  Package,
  Plus,
} from 'lucide-react';
import type { DashboardStats, UserRole } from '../types';
import { formatDate } from '../utils/date';

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
    </div>
  );
}

type KpiAccent = 'amber' | 'emerald' | 'slate';

interface KpiItem {
  label: string;
  value: string | number;
  sub?: string;
  accent?: KpiAccent;
}

function KpiRow({ label, value, sub, accent = 'slate' }: KpiItem) {
  const valueClass =
    accent === 'amber'
      ? 'text-amber-700'
      : accent === 'emerald'
        ? 'text-emerald-700'
        : 'text-slate-900';
  const dotClass =
    accent === 'amber'
      ? 'bg-amber-500'
      : accent === 'emerald'
        ? 'bg-emerald-500'
        : 'bg-slate-400';

  return (
    <div className="flex items-center justify-between gap-6 px-5 py-4 sm:px-6 sm:py-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${dotClass}`} aria-hidden />
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-700">{label}</div>
          {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
        </div>
      </div>
      <div className={`shrink-0 text-right text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function KpiPanel({ items }: { items: KpiItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        <h2 className="text-sm font-semibold text-slate-800">Key performance indicators</h2>
        <p className="mt-0.5 text-xs text-slate-500">Summary metrics for current warehouse activity.</p>
      </div>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <KpiRow key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {empty ? (
        <p className="mt-8 py-16 text-center text-sm text-slate-500">No data available for this period.</p>
      ) : (
        <div className="mt-3 h-[240px]">{children}</div>
      )}
    </div>
  );
}

function PieWidget({ slices, innerRadius }: { slices: DashboardStats['poStatusSlices']; innerRadius?: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="45%"
          innerRadius={innerRadius ?? 0}
          outerRadius={80}
          paddingAngle={2}
        >
          {slices.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [Number(value ?? 0), 'Records']} />
        <Legend verticalAlign="bottom" height={36} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function DeliveryTable({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: DashboardStats['deliverySoon'];
  tone: 'amber' | 'red';
}) {
  const headerClass = tone === 'red' ? 'text-red-700' : 'text-amber-700';
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className={`px-5 py-4 border-b border-slate-200 bg-slate-50 ${headerClass} text-sm font-semibold`}>
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            <tr>
              <th className="px-4 py-2.5">PO number</th>
              <th className="px-4 py-2.5">Client code</th>
              <th className="px-4 py-2.5">Estimated delivery</th>
              <th className="px-4 py-2.5">Fulfillment</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No records on file.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.poNumber} className="border-t">
                <td className="px-4 py-2.5 font-mono">{row.poNumber}</td>
                <td className="px-4 py-2.5">{row.clientCode}</td>
                <td className="px-4 py-2.5">{formatDate(row.estimatedDeliveryDate)}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.fulfillmentPct >= 100
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-900'
                    }`}
                  >
                    {row.fulfillmentPct}% ({row.scannedQty}/{row.orderedQty})
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QuickLink({
  to,
  label,
  icon: Icon,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
    >
      <Icon size={16} className="text-slate-600" />
      {label}
      <ArrowRight size={14} className="ml-auto text-slate-400" />
    </Link>
  );
}

export function DashboardPanel({ stats, role }: { stats: DashboardStats; role: UserRole }) {
  const { kpis, showPo, showSow } = stats;
  const hasAnyData =
    (showPo && (kpis.openPos + kpis.fulfilledPos > 0)) ||
    (showSow && (kpis.activeSows + kpis.completedSows > 0));

  const kpiItems: KpiItem[] = [];
  if (showPo) {
    kpiItems.push(
      { label: 'Open purchase orders', value: kpis.openPos, accent: 'amber' },
      { label: 'Fulfilled purchase orders', value: kpis.fulfilledPos, accent: 'emerald' }
    );
  }
  if (showSow) {
    kpiItems.push(
      { label: 'Active shipment orders', value: kpis.activeSows, accent: 'amber' },
      { label: 'Completed shipment orders', value: kpis.completedSows, accent: 'emerald' },
      { label: 'Units packed', value: kpis.productsPacked.toLocaleString() },
      {
        label: 'Cartons packed',
        value: kpis.boxesPacked.toLocaleString(),
        sub: 'Across all shipment orders',
      }
    );
  }
  if (kpis.fulfillmentPct != null) {
    kpiItems.push({
      label: 'Fulfillment rate',
      value: `${kpis.fulfillmentPct}%`,
      accent: kpis.fulfillmentPct >= 100 ? 'emerald' : 'amber',
    });
  }

  return (
    <div className="space-y-10">
      {!hasAnyData && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <p className="text-sm font-medium text-slate-700">No operational data available.</p>
          <p className="mt-1 text-sm text-slate-500">
            Create a purchase order or shipment order to begin tracking fulfillment metrics.
          </p>
        </div>
      )}

      <section>
        <KpiPanel items={kpiItems} />
      </section>

      <section>
        <SectionHeading title="Operational analytics" description="Status distribution and throughput analysis." />
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {showPo && (
            <ChartCard title="Purchase order status" empty={stats.poStatusSlices.length === 0}>
              <PieWidget slices={stats.poStatusSlices} />
            </ChartCard>
          )}
          {showSow && (
            <>
              <ChartCard title="Shipment order status" empty={stats.sowStatusSlices.length === 0}>
                <PieWidget slices={stats.sowStatusSlices} />
              </ChartCard>
              <ChartCard title="Active fulfillment progress" empty={stats.progressSlices.length === 0}>
                <PieWidget slices={stats.progressSlices} innerRadius={55} />
              </ChartCard>
              <ChartCard title="Packing configuration mix" empty={stats.packingTypeSlices.length === 0}>
                <PieWidget slices={stats.packingTypeSlices} />
              </ChartCard>
            </>
          )}
        </div>
      </section>

      {(showPo && stats.topPos.length > 0) || (showSow && stats.topSkus.length > 0) ? (
        <section>
          <SectionHeading
            title="Throughput ranking"
            description="Highest-volume purchase orders and SKUs by units processed."
          />
          <div className="grid lg:grid-cols-2 gap-4 overflow-x-auto">
            {showPo && stats.topPos.length > 0 && (
              <ChartCard title="Leading purchase orders by fulfillment volume">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topPos} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="poNumber" width={72} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, _name, item) => {
                        const row = item.payload as DashboardStats['topPos'][0];
                        const n = Number(value ?? 0);
                        return [`${n} / ${row.ordered} (${row.pct}%)`, 'Units fulfilled'];
                      }}
                    />
                    <Bar dataKey="scanned" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
            {showSow && stats.topSkus.length > 0 && (
              <ChartCard title="Leading SKUs by units shipped">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topSkus} margin={{ bottom: 48 }}>
                    <XAxis dataKey="sku" tick={{ fontSize: 10 }} angle={-35} textAnchor="end" height={56} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value) => [Number(value ?? 0), 'Units shipped']}
                      labelFormatter={(_label, payload) => {
                        const row = payload?.[0]?.payload as DashboardStats['topSkus'][0] | undefined;
                        return row ? `${row.sku} — ${row.productName}` : '';
                      }}
                    />
                    <Bar dataKey="scanned" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </section>
      ) : null}

      {showPo && (
        <section>
          <SectionHeading
            title="Delivery schedule"
            description="Open purchase orders grouped by estimated delivery date."
          />
          <div className="grid lg:grid-cols-2 gap-4">
            <DeliveryTable title="Deliveries due within 14 days" rows={stats.deliverySoon} tone="amber" />
            <DeliveryTable title="Overdue deliveries" rows={stats.deliveryOverdue} tone="red" />
          </div>
        </section>
      )}

      {showSow && stats.recentActiveSows.length > 0 && (
        <section>
          <SectionHeading
            title="Active shipment orders"
            description="In-progress packing assignments requiring attention."
          />
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-4 py-2.5">SOW number</th>
                    <th className="px-4 py-2.5">PO number</th>
                    <th className="px-4 py-2.5">Fulfillment</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {stats.recentActiveSows.map((sow) => (
                    <tr key={sow._id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-mono text-slate-800">{sow.sowNumber}</td>
                      <td className="px-4 py-2.5 font-mono text-slate-800">{sow.poNumber}</td>
                      <td className="px-4 py-2.5 text-slate-700">
                        {sow.progressPct}% complete ({sow.scannedQty}/{sow.orderedQty} units)
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          to={`/pack/${sow._id}`}
                          className="text-sm font-medium text-slate-700 hover:text-slate-900 hover:underline"
                        >
                          View order
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section>
        <SectionHeading title="Navigation" description="Direct access to core operational workflows." />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(role === 'admin' || role === 'worker') && (
            <>
              <QuickLink to="/sow" label="Shipment order register" icon={Layers} />
              <QuickLink to="/sow" label="Active packing queue" icon={Package} />
            </>
          )}
          {(role === 'admin' || role === 'po') && (
            <>
              <QuickLink to="/pos" label="Purchase order register" icon={FileText} />
              <QuickLink to="/pos" label="Create purchase order" icon={Plus} />
            </>
          )}
          {role === 'admin' && (
            <>
              <QuickLink to="/admin/history" label="Packing history" icon={ClipboardList} />
              <QuickLink to="/admin/logs" label="Audit log" icon={History} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
