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

/** Dark blue palette for dashboard charts */
const CHART_COLORS = {
  dark: '#1e3a8a',
  mid: '#2563eb',
  light: '#60a5fa',
  pale: '#dbeafe',
  muted: '#cbd5e1',
  palette: ['#1e3a8a', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
} as const;

function mapSliceLabels(slices: DashboardStats['poStatusSlices']): DashboardStats['poStatusSlices'] {
  const labelMap: Record<string, string> = {
    Open: 'Total',
    Fulfilled: 'Completed',
    Packing: 'Total',
    Completed: 'Completed',
  };
  const colorMap: Record<string, string> = {
    Completed: CHART_COLORS.dark,
    Total: CHART_COLORS.light,
    Open: CHART_COLORS.light,
    Fulfilled: CHART_COLORS.dark,
    Packing: CHART_COLORS.light,
  };
  return slices.map((slice, index) => {
    const name = labelMap[slice.name] ?? slice.name;
    return {
      ...slice,
      name,
      color:
        colorMap[name] ??
        colorMap[slice.name] ??
        CHART_COLORS.palette[index % CHART_COLORS.palette.length],
    };
  });
}

function StatusHorizonBar({
  totalLabel,
  total,
  completed,
  entityName,
}: {
  totalLabel: string;
  total: number;
  completed: number;
  entityName: string;
}) {
  const completedPct = total > 0 ? (completed / total) * 100 : 0;
  const remainingPct = total > 0 ? 100 - completedPct : 0;

  return (
    <div className="flex flex-col justify-center px-6 py-6 sm:px-7 sm:py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-400">{totalLabel}</div>
          <div className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-slate-900 sm:text-[2rem]">
            {total}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-slate-400">Completed</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-blue-900">
            {completed}
            <span className="ml-1 text-sm font-medium text-slate-400">
              ({Math.round(completedPct)}%)
            </span>
          </div>
        </div>
      </div>

      <div
        className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-slate-100"
        role="img"
        aria-label={`${completed} completed of ${total} total ${entityName}`}
      >
        {completed > 0 && (
          <div
            className="h-full transition-all"
            style={{ width: `${completedPct}%`, backgroundColor: CHART_COLORS.dark }}
          />
        )}
        {total - completed > 0 && (
          <div
            className="h-full transition-all"
            style={{ width: `${remainingPct}%`, backgroundColor: CHART_COLORS.light }}
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: CHART_COLORS.dark }}
          />
          Completed <span className="font-semibold tabular-nums text-slate-800">{completed}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: CHART_COLORS.light }}
          />
          Total <span className="font-semibold tabular-nums text-slate-800">{total - completed}</span>
        </span>
      </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(220px,32%)]">
          <StatusHorizonBar
            totalLabel="Total purchase orders"
            total={total}
            completed={fulfilledPos}
            entityName="purchase orders"
          />
          <div className="border-t border-slate-100 lg:border-t-0 lg:border-l lg:border-slate-100 px-4 py-4 sm:px-5">
            <div className="h-[220px]">
              <PieWidget slices={mapSliceLabels(slices)} innerRadius={58} />
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(220px,32%)]">
          <StatusHorizonBar
            totalLabel="Total shipment orders"
            total={total}
            completed={completedSows}
            entityName="shipment orders"
          />
          <div className="border-t border-slate-100 lg:border-t-0 lg:border-l lg:border-slate-100 px-4 py-4 sm:px-5">
            <div className="h-[220px]">
              <PieWidget slices={mapSliceLabels(slices)} innerRadius={58} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({
  title,
  children,
  empty,
  chartHeight = 240,
}: {
  title: string;
  children: ReactNode;
  empty?: boolean;
  chartHeight?: number;
}) {
  return (
    <div className={`${CARD_CLASS} p-6`}>
      <h3 className="text-base font-semibold text-slate-800">{title}</h3>
      {empty ? (
        <p className="mt-8 py-16 text-center text-sm text-slate-400">No data available for this period.</p>
      ) : (
        <div className="mt-4" style={{ height: chartHeight }}>
          {children}
        </div>
      )}
    </div>
  );
}

function SkuChartTick(props: {
  x?: string | number;
  y?: string | number;
  payload?: { value?: string };
  items: DashboardStats['topSkus'];
}) {
  const x = Number(props.x ?? 0);
  const y = Number(props.y ?? 0);
  const { payload, items } = props;
  const row = items.find((item) => item.sku === payload?.value);
  const productName = row?.productName ?? '';
  const maxLen = 22;
  const displayName =
    productName.length > maxLen ? `${productName.slice(0, maxLen)}…` : productName;

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={12}
        textAnchor="middle"
        fill="#1e293b"
        fontSize={10}
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
      >
        {payload?.value}
      </text>
      <text x={0} y={0} dy={26} textAnchor="middle" fill="#64748b" fontSize={9}>
        {displayName}
      </text>
    </g>
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
          description="Purchase order and shipment order status overview."
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
        </div>
      </section>

      {showSow && stats.topSkus.length > 0 ? (
        <section>
          <SectionHeading
            title="Throughput ranking"
            description="SKUs ranked by units shipped, with product names shown below each SKU."
          />
          <ChartCard
            title="Leading SKUs by units shipped"
            chartHeight={Math.max(280, stats.topSkus.length * 36 + 120)}
          >
            <div
              className="h-full overflow-x-auto"
              style={{ minWidth: '100%', width: Math.max(stats.topSkus.length * 88, 480) }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topSkus} margin={{ bottom: 56, left: 8, right: 16, top: 8 }}>
                  <XAxis
                    dataKey="sku"
                    interval={0}
                    tickLine={false}
                    axisLine={{ stroke: '#e2e8f0' }}
                    tick={(props) => (
                      <SkuChartTick
                        x={props.x}
                        y={props.y}
                        payload={props.payload}
                        items={stats.topSkus}
                      />
                    )}
                    height={56}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value) => [Number(value ?? 0), 'Units shipped']}
                    labelFormatter={(_label, payload) => {
                      const row = payload?.[0]?.payload as DashboardStats['topSkus'][0] | undefined;
                      return row ? `${row.sku} — ${row.productName}` : '';
                    }}
                  />
                  <Bar dataKey="scanned" fill={CHART_COLORS.dark} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
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
