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
    <div className="mb-5">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  );
}

const CARD_CLASS =
  'rounded-2xl bg-white shadow-[0_4px_24px_rgba(15,23,42,0.06)] ring-1 ring-slate-100';

type KpiAccent = 'amber' | 'emerald' | 'slate';

interface KpiItem {
  label: string;
  value: string | number;
  accent?: KpiAccent;
  statusText?: string;
  progressPct?: number;
  showDonut?: boolean;
}

function chunkRows<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}

function KpiStatusChip({ text, accent = 'slate' }: { text: string; accent?: KpiAccent }) {
  const className =
    accent === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : accent === 'amber'
        ? 'bg-amber-50 text-amber-800 ring-amber-100'
        : 'bg-slate-50 text-slate-600 ring-slate-100';
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}
    >
      {text}
    </span>
  );
}

function KpiProgressBar({ pct, accent = 'slate' }: { pct: number; accent?: KpiAccent }) {
  const fillClass =
    accent === 'emerald' ? 'bg-emerald-500' : accent === 'amber' ? 'bg-amber-500' : 'bg-slate-400';
  return (
    <div className="h-1 w-full max-w-[140px] rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${fillClass}`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
}

function KpiMiniDonut({ pct, accent = 'slate' }: { pct: number; accent?: KpiAccent }) {
  const fill = accent === 'emerald' ? '#10b981' : accent === 'amber' ? '#f59e0b' : '#64748b';
  const clamped = Math.min(100, Math.max(0, pct));
  const data = [
    { name: 'filled', value: clamped },
    { name: 'remaining', value: 100 - clamped },
  ];
  return (
    <div className="relative h-12 w-12 shrink-0">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            cx="50%"
            cy="50%"
            innerRadius={14}
            outerRadius={22}
            startAngle={90}
            endAngle={-270}
            stroke="none"
          >
            <Cell fill={fill} />
            <Cell fill="#f1f5f9" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums text-slate-700">
        {clamped}%
      </span>
    </div>
  );
}

function KpiTile({
  label,
  value,
  statusText,
  progressPct,
  showDonut,
  accent = 'slate',
}: KpiItem) {
  return (
    <div className="flex min-h-[120px] flex-col justify-between px-6 py-5 sm:px-7 sm:py-6">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-3xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[2rem]">
            {value}
          </div>
          {statusText && (
            <div className="mt-2">
              <KpiStatusChip text={statusText} accent={accent} />
            </div>
          )}
          {progressPct != null && !showDonut && (
            <div className="mt-2.5">
              <KpiProgressBar pct={progressPct} accent={accent} />
            </div>
          )}
        </div>
        {showDonut && progressPct != null && <KpiMiniDonut pct={progressPct} accent={accent} />}
      </div>
    </div>
  );
}

function KpiPanel({ items }: { items: KpiItem[] }) {
  if (items.length === 0) return null;

  const rows = chunkRows(items, 3);

  return (
    <div className={CARD_CLASS}>
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className={`grid grid-cols-1 md:grid-cols-3 ${rowIndex > 0 ? 'border-t border-slate-100' : ''}`}
        >
          {row.map((item, colIndex) => (
            <div
              key={item.label}
              className={colIndex > 0 ? 'border-t border-slate-100 md:border-t-0 md:border-l md:border-slate-100' : ''}
            >
              <KpiTile {...item} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PoStatusPanel({
  openPos,
  fulfilledPos,
  slices,
}: {
  openPos: number;
  fulfilledPos: number;
  slices: DashboardStats['poStatusSlices'];
}) {
  const total = openPos + fulfilledPos;
  const shareProgress = (part: number) => (total > 0 ? Math.round((part / total) * 100) : undefined);
  const statusOfTotal = (part: number) => (total > 0 ? `${part} of ${total} total` : undefined);

  return (
    <div className={CARD_CLASS}>
      <div className="border-b border-slate-100 px-6 py-4 sm:px-7">
        <h3 className="text-base font-semibold text-slate-800">Purchase order status</h3>
      </div>
      {total === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-slate-400 sm:px-7">
          No purchase orders recorded yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_minmax(220px,32%)]">
          <KpiTile
            label="Open purchase orders"
            value={openPos}
            accent="amber"
            statusText={statusOfTotal(openPos)}
            progressPct={shareProgress(openPos)}
          />
          <div className="border-t border-slate-100 lg:border-t-0 lg:border-l lg:border-slate-100">
            <KpiTile
              label="Fulfilled purchase orders"
              value={fulfilledPos}
              accent="emerald"
              statusText={statusOfTotal(fulfilledPos)}
              progressPct={shareProgress(fulfilledPos)}
            />
          </div>
          <div className="border-t border-slate-100 lg:border-t-0 lg:border-l lg:border-slate-100 px-4 py-4 sm:px-5">
            <div className="h-[220px]">
              <PieWidget slices={slices} innerRadius={58} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SowStatusPanel({
  activeSows,
  completedSows,
  slices,
}: {
  activeSows: number;
  completedSows: number;
  slices: DashboardStats['sowStatusSlices'];
}) {
  const total = activeSows + completedSows;
  const shareProgress = (part: number) => (total > 0 ? Math.round((part / total) * 100) : undefined);
  const statusOfTotal = (part: number) => (total > 0 ? `${part} of ${total} total` : undefined);

  return (
    <div className={CARD_CLASS}>
      <div className="border-b border-slate-100 px-6 py-4 sm:px-7">
        <h3 className="text-base font-semibold text-slate-800">Shipment order status</h3>
      </div>
      {total === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-slate-400 sm:px-7">
          No shipment orders recorded yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_minmax(220px,32%)]">
          <KpiTile
            label="Active shipment orders"
            value={activeSows}
            accent="amber"
            statusText={statusOfTotal(activeSows)}
            progressPct={shareProgress(activeSows)}
          />
          <div className="border-t border-slate-100 lg:border-t-0 lg:border-l lg:border-slate-100">
            <KpiTile
              label="Completed shipment orders"
              value={completedSows}
              accent="emerald"
              statusText={statusOfTotal(completedSows)}
              progressPct={shareProgress(completedSows)}
            />
          </div>
          <div className="border-t border-slate-100 lg:border-t-0 lg:border-l lg:border-slate-100 px-4 py-4 sm:px-5">
            <div className="h-[220px]">
              <PieWidget slices={slices} innerRadius={58} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <div className={`${CARD_CLASS} p-6`}>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {empty ? (
        <p className="mt-8 py-16 text-center text-sm text-slate-400">No data available for this period.</p>
      ) : (
        <div className="mt-4 h-[240px]">{children}</div>
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

function FulfillmentBadge({
  pct,
  scanned,
  ordered,
}: {
  pct: number;
  scanned: number;
  ordered: number;
}) {
  const done = pct >= 100;
  return (
    <div className="flex flex-col gap-1.5">
      <span
        className={`inline-flex w-fit flex-wrap items-center gap-x-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
          done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
        }`}
      >
        <span>{pct}%</span>
        <span className={`font-normal ${done ? 'text-emerald-700' : 'text-amber-800'}`}>
          ({scanned}/{ordered} units)
        </span>
      </span>
      {ordered > 0 && (
        <div className="h-1.5 w-full max-w-[140px] rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${done ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
      )}
    </div>
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
    <div className={`${CARD_CLASS} overflow-hidden`}>
      <div className={`border-b border-slate-100 bg-slate-50/80 px-6 py-4 ${headerClass} text-sm font-semibold`}>
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
      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_2px_12px_rgba(15,23,42,0.05)] ring-1 ring-slate-100 transition hover:ring-blue-200 hover:shadow-[0_4px_16px_rgba(59,130,246,0.08)]"
    >
      <Icon size={16} className="text-blue-500" />
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
  if (kpis.fulfillmentPct != null) {
    kpiItems.push({
      label: 'Fulfillment rate',
      value: `${kpis.fulfillmentPct}%`,
      accent: kpis.fulfillmentPct >= 100 ? 'emerald' : 'amber',
      statusText: kpis.fulfillmentPct >= 100 ? 'Target met' : 'In progress',
      progressPct: kpis.fulfillmentPct,
      showDonut: true,
    });
  }

  return (
    <div className="space-y-8">
      {!hasAnyData && (
        <div className={`${CARD_CLASS} px-6 py-12 text-center`}>
          <p className="text-sm font-medium text-slate-700">No operational data available.</p>
          <p className="mt-1 text-sm text-slate-400">
            Create a purchase order or shipment order to begin tracking fulfillment metrics.
          </p>
        </div>
      )}

      {showSow && stats.recentActiveSows.length > 0 && (
        <section>
          <SectionHeading
            title="Active shipment orders"
            description="In-progress packing assignments requiring attention."
          />
          <div className={`${CARD_CLASS} overflow-hidden`}>
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
                      <td className="px-4 py-2.5">
                        <FulfillmentBadge
                          pct={sow.progressPct}
                          scanned={sow.scannedQty}
                          ordered={sow.orderedQty}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          to={`/pack/${sow._id}`}
                          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
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

      <section>
        <SectionHeading
          title="Key performance indicators & operational analytics"
          description="Summary metrics, status distribution, and packing analysis."
        />
        <div className="space-y-4">
          {showPo && (
            <PoStatusPanel
              openPos={kpis.openPos}
              fulfilledPos={kpis.fulfilledPos}
              slices={stats.poStatusSlices}
            />
          )}
          {showSow && (
            <SowStatusPanel
              activeSows={kpis.activeSows}
              completedSows={kpis.completedSows}
              slices={stats.sowStatusSlices}
            />
          )}
          <KpiPanel items={kpiItems} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showSow && (
              <>
                <ChartCard title="Active fulfillment progress" empty={stats.progressSlices.length === 0}>
                  <PieWidget slices={stats.progressSlices} innerRadius={55} />
                </ChartCard>
                <ChartCard title="Packing configuration mix" empty={stats.packingTypeSlices.length === 0}>
                  <PieWidget slices={stats.packingTypeSlices} />
                </ChartCard>
              </>
            )}
          </div>
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
                    <Bar dataKey="scanned" fill="#3b82f6" radius={[0, 4, 4, 0]} />
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
                    <Bar dataKey="scanned" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}
          </div>
        </section>
      ) : null}

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
