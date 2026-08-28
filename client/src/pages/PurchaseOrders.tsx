import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  LayersArrowUp,
  Package,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import type { ProductName, PurchaseOrder, Sow } from '../types';
import { formatDate, formatDateTime } from '../utils/date';

const TYPES: Array<{ id: 1 | 2 | 3; title: string; icons: LucideIcon[] }> = [
  { id: 1, title: 'Only box', icons: [Package] },
  { id: 2, title: '1 pallet with 1 SKU', icons: [Package, LayersArrowUp] },
  { id: 3, title: '1 pallet with multi SKU', icons: [Boxes, LayersArrowUp] },
];

type PoSortKey =
  | 'poNumber'
  | 'clientCode'
  | 'productOrder'
  | 'progress'
  | 'status'
  | 'createdAt'
  | 'createdBy';
type SortDir = 'asc' | 'desc';
type PoStatusFilter = 'all' | 'open' | 'fulfilled';

function poStatusOf(order: PurchaseOrder): 'open' | 'fulfilled' {
  return order.status === 'fulfilled' ? 'fulfilled' : 'open';
}

function PoStatusBadge({ status }: { status: 'open' | 'fulfilled' }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        status === 'fulfilled'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-amber-100 text-amber-900'
      }`}
    >
      {status}
    </span>
  );
}

type ProductOrderLine = { productName: string; qty: number; sku?: string };

function parseProductOrderLines(
  items?: ProductOrderLine[],
  productOrder?: string
): ProductOrderLine[] {
  if (items?.length) {
    return items.map((i) => ({
      productName: i.productName,
      qty: i.qty,
      sku: i.sku,
    }));
  }
  if (!productOrder?.trim()) return [];
  return productOrder
    .split(/[,，]/)
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) return null;
      const match = trimmed.match(/^(.+?)\*(\d+)$/);
      if (match) {
        return { productName: match[1].trim(), qty: Number(match[2]) };
      }
      return { productName: trimmed, qty: 0 };
    })
    .filter((row): row is ProductOrderLine => row != null);
}

function ProductOrderList({
  items,
  productOrder,
  compact,
}: {
  items?: ProductOrderLine[];
  productOrder?: string;
  compact?: boolean;
}) {
  const rows = parseProductOrderLines(items, productOrder);
  if (!rows.length) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <ul className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {rows.map((row, index) => (
        <li
          key={`${row.sku || row.productName}-${index}`}
          className={`flex items-baseline justify-between gap-3 border-b border-slate-100 pb-1 last:border-b-0 last:pb-0 ${
            compact ? 'text-xs' : 'text-sm'
          }`}
        >
          <div className="min-w-0">
            <div className="font-medium text-slate-800 truncate">{row.productName}</div>
            {row.sku && (
              <div className="font-mono text-[10px] text-slate-400 truncate">{row.sku}</div>
            )}
          </div>
          <span className="shrink-0 font-semibold tabular-nums text-slate-700 whitespace-nowrap">
            ×{row.qty} (inner Box)
          </span>
        </li>
      ))}
    </ul>
  );
}

function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  column: PoSortKey;
  sortKey: PoSortKey;
  sortDir: SortDir;
  onSort: (key: PoSortKey) => void;
}) {
  return (
    <th className="px-4 py-3 font-medium whitespace-nowrap">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 hover:bg-slate-200/70 hover:text-slate-900 ${
          sortKey === column ? 'text-slate-900' : ''
        }`}
      >
        {label}
        {sortKey === column ? (
          sortDir === 'asc' ? (
            <ChevronUp size={13} />
          ) : (
            <ChevronDown size={13} />
          )
        ) : (
          <ChevronsUpDown size={13} className="opacity-40" />
        )}
      </button>
    </th>
  );
}

export function PurchaseOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPack = user?.role === 'admin' || user?.role === 'worker';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [skuOptions, setSkuOptions] = useState<ProductName[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientCode, setClientCode] = useState('');
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
  const [previewPo, setPreviewPo] = useState('');
  const [qtys, setQtys] = useState<Record<string, string>>({});

  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [createSowOpen, setCreateSowOpen] = useState(false);
  const [sowBusy, setSowBusy] = useState(false);
  const [batchNo, setBatchNo] = useState('');
  const [packingType, setPackingType] = useState<1 | 2 | 3 | null>(null);
  const [selectedSKUs, setSelectedSKUs] = useState<string[]>([]);
  const [targetQtys, setTargetQtys] = useState<Record<string, string>>({});
  const [previewSow, setPreviewSow] = useState('');
  const [sortKey, setSortKey] = useState<PoSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<PoStatusFilter>('all');

  function handleSort(key: PoSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'createdAt' || key === 'progress' ? 'desc' : 'asc');
    }
  }

  const sortedOrders = useMemo(() => {
    let list = [...orders];
    if (statusFilter !== 'all') {
      list = list.filter((o) => poStatusOf(o) === statusFilter);
    }
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'poNumber') cmp = a.poNumber.localeCompare(b.poNumber);
      else if (sortKey === 'clientCode') cmp = a.clientCode.localeCompare(b.clientCode);
      else if (sortKey === 'productOrder')
        cmp = (a.productOrder || '').localeCompare(b.productOrder || '');
      else if (sortKey === 'createdBy')
        cmp = (a.createdBy?.username || '').localeCompare(b.createdBy?.username || '');
      else if (sortKey === 'createdAt')
        cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === 'status') cmp = poStatusOf(a).localeCompare(poStatusOf(b));
      else if (sortKey === 'progress') {
        const pctA = a.orderedQty ? (a.scannedQty ?? 0) / a.orderedQty : 0;
        const pctB = b.orderedQty ? (b.scannedQty ?? 0) / b.orderedQty : 0;
        cmp = pctA - pctB;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [orders, sortKey, sortDir, statusFilter]);

  const statusCounts = useMemo(() => {
    let open = 0;
    let fulfilled = 0;
    for (const o of orders) {
      if (poStatusOf(o) === 'fulfilled') fulfilled += 1;
      else open += 1;
    }
    return { all: orders.length, open, fulfilled };
  }, [orders]);

  async function load() {
    const [poData, skuData] = await Promise.all([
      api<{ orders: PurchaseOrder[] }>('/api/purchase-orders'),
      api<{ names: ProductName[] }>('/api/product-names'),
    ]);
    setOrders(poData.orders);
    setSkuOptions(skuData.names);
  }

  useEffect(() => {
    load().catch((err: Error) => toast.error(err.message));
  }, []);

  async function openCreate() {
    setClientCode('');
    setEstimatedDeliveryDate('');
    setQtys({});
    try {
      const data = await api<{ poNumber: string }>('/api/purchase-orders/next-number');
      setPreviewPo(data.poNumber);
    } catch {
      setPreviewPo('');
    }
    setOpen(true);
  }

  async function openOrder(order: PurchaseOrder) {
    try {
      const data = await api<{ order: PurchaseOrder }>(
        `/api/purchase-orders/${encodeURIComponent(order.poNumber)}`
      );
      setDetail(data.order);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load PO');
    }
  }

  async function startCreateSow() {
    if (!detail) return;
    if (detail.status === 'fulfilled' || (detail.remainingQty ?? 0) <= 0) {
      toast.error('No remaining quantity to allocate on this PO');
      return;
    }
    setBatchNo('');
    setPackingType(null);
    const available = (detail.progressItems || []).filter(
      (i) => (i.remainingQty ?? Math.max(0, i.orderedQty - i.scannedQty)) > 0
    );
    const skus = available.map((i) => i.sku);
    setSelectedSKUs(skus);
    const qtys: Record<string, string> = {};
    for (const item of available) {
      const rem = item.remainingQty ?? Math.max(0, item.orderedQty - item.scannedQty);
      qtys[item.sku] = String(rem);
    }
    setTargetQtys(qtys);
    try {
      const data = await api<{ sowNumber: string }>(
        `/api/sows/next-number?poNumber=${encodeURIComponent(detail.poNumber)}`
      );
      setPreviewSow(data.sowNumber);
    } catch {
      setPreviewSow('');
    }
    setCreateSowOpen(true);
  }

  function remainingForSku(sku: string): number {
    const item = detail?.progressItems?.find((i) => i.sku === sku);
    if (!item) return 0;
    return item.remainingQty ?? Math.max(0, item.orderedQty - item.scannedQty);
  }

  function toggleSku(sku: string) {
    const rem = remainingForSku(sku);
    if (rem <= 0) {
      toast.error('No remaining quantity for this SKU');
      return;
    }
    setSelectedSKUs((prev) => {
      if (packingType === 1 || packingType === 2) {
        const next = prev.includes(sku) && prev.length === 1 ? [] : [sku];
        if (next.includes(sku) && !targetQtys[sku]) {
          setTargetQtys((q) => ({ ...q, [sku]: String(rem) }));
        }
        return next;
      }
      if (prev.includes(sku)) {
        return prev.filter((s) => s !== sku);
      }
      setTargetQtys((q) => ({ ...q, [sku]: q[sku] || String(rem) }));
      return [...prev, sku];
    });
  }

  async function submitSow(e: FormEvent) {
    e.preventDefault();
    if (!detail) return;
    if (!batchNo.trim()) {
      toast.error('Enter Batch NO');
      return;
    }
    if (!packingType) {
      toast.error('Select a packing type');
      return;
    }
    if ((packingType === 1 || packingType === 2) && selectedSKUs.length !== 1) {
      toast.error('Select exactly 1 SKU');
      return;
    }
    if (packingType === 3 && selectedSKUs.length < 2) {
      toast.error('Select multiple SKUs');
      return;
    }
    const targetItems = selectedSKUs.map((sku) => {
      const rem = remainingForSku(sku);
      const qty = Math.floor(Number(targetQtys[sku]));
      return { sku, targetQty: qty, rem };
    });
    for (const t of targetItems) {
      if (!Number.isFinite(t.targetQty) || t.targetQty < 1) {
        toast.error(`Enter a valid target qty for ${t.sku}`);
        return;
      }
      if (t.targetQty > t.rem) {
          toast.error(`Target for ${t.sku} exceeds left to allocate (${t.rem})`);
        return;
      }
    }
    setSowBusy(true);
    try {
      const data = await api<{ sow: Sow }>('/api/sows', {
        method: 'POST',
        body: {
          poNumber: detail.poNumber,
          batchNo: batchNo.trim(),
          clientCode: detail.clientCode,
          packingType,
          selectedSKUs,
          targetItems: targetItems.map(({ sku, targetQty }) => ({ sku, targetQty })),
        },
      });
      toast.success(`Created ${data.sow.sowNumber}`);
      setCreateSowOpen(false);
      setDetail(null);
      await load();
      if (canPack) {
        navigate(`/pack/${data.sow._id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSowBusy(false);
    }
  }

  const lines = useMemo(
    () =>
      skuOptions
        .map((opt) => ({ ...opt, qty: Number(qtys[opt.sku]) || 0 }))
        .filter((opt) => opt.qty > 0),
    [skuOptions, qtys]
  );

  const productOrderLines = useMemo(
    () => lines.map((l) => ({ productName: l.name, sku: l.sku, qty: l.qty })),
    [lines]
  );

  async function createPo(e: FormEvent) {
    e.preventDefault();
    if (!clientCode.trim()) {
      toast.error('Enter Client ID');
      return;
    }
    if (!lines.length) {
      toast.error('Enter at least one product quantity');
      return;
    }
    if (!estimatedDeliveryDate) {
      toast.error('Select estimated delivery date');
      return;
    }
    setBusy(true);
    try {
      const data = await api<{ order: PurchaseOrder }>('/api/purchase-orders', {
        method: 'POST',
        body: {
          clientCode: clientCode.trim(),
          estimatedDeliveryDate,
          items: lines.map((l) => ({ sku: l.sku, productName: l.name, qty: l.qty })),
        },
      });
      toast.success(`Created ${data.order.poNumber}`);
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
          <p className="text-slate-500 mt-1">
            Click a PO to see scan progress and create a SOW.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-amber-400"
        >
          <Plus size={18} /> Create PO
        </button>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5">
          {([
            { id: 'all', label: 'All' },
            { id: 'open', label: 'Open' },
            { id: 'fulfilled', label: 'Fulfilled' },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                statusFilter === tab.id
                  ? tab.id === 'fulfilled'
                    ? 'bg-emerald-600 text-white'
                    : tab.id === 'open'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800 text-white'
                  : 'bg-white border text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
              <span className="ml-1.5 opacity-80">
                {statusCounts[tab.id]}
              </span>
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400 sm:ml-auto">
          {sortedOrders.length} / {orders.length} POs
        </div>
      </div>

      <div className="mt-3 bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <SortHeader label="PO" column="poNumber" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Client ID" column="clientCode" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader
                label="Product order"
                column="productOrder"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
              <SortHeader label="Progress" column="progress" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Status" column="status" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="Created" column="createdAt" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortHeader label="By" column="createdBy" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {sortedOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {orders.length === 0
                    ? 'No purchase orders yet.'
                    : 'No POs match this status filter.'}
                </td>
              </tr>
            )}
            {sortedOrders.map((order) => {
              const ordered = order.orderedQty ?? 0;
              const scanned = order.scannedQty ?? 0;
              const remaining = order.remainingQty ?? Math.max(0, ordered - scanned);
              const pct = ordered > 0 ? Math.min(100, Math.round((scanned / ordered) * 100)) : 0;
              const status = poStatusOf(order);
              return (
                <tr
                  key={order._id}
                  className="border-t align-top hover:bg-amber-50/50 cursor-pointer"
                  onClick={() => openOrder(order)}
                >
                  <td className="px-4 py-3 font-mono font-medium">{order.poNumber}</td>
                  <td className="px-4 py-3">{order.clientCode}</td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <ProductOrderList items={order.items} productOrder={order.productOrder} compact />
                  </td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="font-medium">
                      {scanned}/{ordered}
                      {status !== 'fulfilled' && (
                        <span className="ml-1 text-[11px] font-normal text-slate-400">
                          · {remaining} left to allocate
                        </span>
                      )}
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {order.sowCount || 0} SOW(s)
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <PoStatusBadge status={status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDateTime(order.createdAt)}
                  </td>
                  <td className="px-4 py-3">{order.createdBy?.username || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {detail && !createSowOpen && (
        <Modal title={`PO ${detail.poNumber}`} onClose={() => setDetail(null)} wide>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 border px-3 py-2">
                <div className="text-[11px] uppercase text-slate-400">Status</div>
                <div className="mt-1">
                  <PoStatusBadge status={poStatusOf(detail)} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 border px-3 py-2">
                <div className="text-[11px] uppercase text-slate-400">Client</div>
                <div className="font-semibold">{detail.clientCode}</div>
              </div>
              <div className="rounded-xl bg-slate-50 border px-3 py-2">
                <div className="text-[11px] uppercase text-slate-400">Est. delivery</div>
                <div className="font-semibold">{formatDate(detail.estimatedDeliveryDate)}</div>
              </div>
              <div className="rounded-xl bg-slate-50 border px-3 py-2">
                <div className="text-[11px] uppercase text-slate-400">Ordered</div>
                <div className="font-semibold">{detail.orderedQty ?? 0} products</div>
              </div>
              <div className="rounded-xl bg-slate-50 border px-3 py-2">
                <div className="text-[11px] uppercase text-slate-400">Scanned</div>
                <div className="font-semibold">
                  {detail.scannedQty ?? 0} / {detail.orderedQty ?? 0}
                </div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Product progress</div>
              <table className="w-full text-sm border rounded-xl overflow-hidden">
                <thead className="bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">Ordered</th>
                    <th className="px-3 py-2 font-medium">Scanned</th>
                    <th className="px-3 py-2 font-medium">Left to allocate</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.progressItems || []).map((item) => {
                    const rem = item.remainingQty ?? Math.max(0, item.orderedQty - item.scannedQty);
                    const done = item.scannedQty >= item.orderedQty && item.orderedQty > 0;
                    return (
                      <tr key={item.sku} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.productName}</div>
                          <div className="font-mono text-xs text-slate-400">{item.sku}</div>
                        </td>
                        <td className="px-3 py-2">{item.orderedQty}</td>
                        <td className="px-3 py-2">{item.scannedQty}</td>
                        <td className="px-3 py-2">{rem}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              done
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {done ? 'Complete' : 'In progress'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {((detail.sows && detail.sows.length > 0) ||
              (detail.sowNumbers && detail.sowNumbers.length > 0)) && (
              <div className="text-sm text-slate-600">
                <div className="font-medium text-slate-800 mb-1.5">Linked SOWs</div>
                <div className="flex flex-wrap gap-2">
                  {(detail.sows && detail.sows.length
                    ? detail.sows
                    : (detail.sowNumbers || []).map((sowNumber) => ({
                        _id: '',
                        sowNumber,
                      }))
                  ).map((sow) =>
                    canPack && sow._id ? (
                      <button
                        key={sow._id}
                        type="button"
                        className="font-mono text-sm rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-950 hover:bg-amber-100 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetail(null);
                          navigate(`/pack/${sow._id}`);
                        }}
                      >
                        {sow.sowNumber}
                      </button>
                    ) : (
                      <span
                        key={sow.sowNumber}
                        className="font-mono text-sm rounded-lg border bg-slate-50 px-2.5 py-1 text-slate-700"
                        title={
                          canPack
                            ? undefined
                            : 'Open packing from a worker/admin account'
                        }
                      >
                        {sow.sowNumber}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                className="rounded-lg border px-4 py-2 text-sm"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
              <button
                disabled={
                  detail.status === 'fulfilled' ||
                  (detail.remainingQty ?? 0) <= 0
                }
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
                onClick={startCreateSow}
                title={
                  detail.status === 'fulfilled' || (detail.remainingQty ?? 0) <= 0
                    ? 'No quantity left to allocate'
                    : undefined
                }
              >
                Create SOW
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detail && createSowOpen && (
        <Modal
          title={`Create SOW for ${detail.poNumber}`}
          onClose={() => setCreateSowOpen(false)}
          wide
        >
          <form className="space-y-4" onSubmit={submitSow}>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <label className="block">
                <span className="font-medium">PO Number</span>
                <input
                  className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 font-mono"
                  value={detail.poNumber}
                  readOnly
                />
              </label>
              <label className="block">
                <span className="font-medium">SOW Number</span>
                <input
                  className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 font-mono"
                  value={previewSow || 'Auto on save'}
                  readOnly
                />
              </label>
              <label className="block">
                <span className="font-medium">Client ID</span>
                <input
                  className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2"
                  value={detail.clientCode}
                  readOnly
                />
              </label>
              <label className="block">
                <span className="font-medium">Batch NO</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  required
                  autoFocus
                />
              </label>
            </div>

            {(detail.items?.length || detail.productOrder) && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2">
                <div className="text-xs uppercase tracking-wide text-amber-700 font-medium">
                  Product order
                </div>
                <div className="mt-2">
                  <ProductOrderList items={detail.items} productOrder={detail.productOrder} />
                </div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium mb-2">Packing type</div>
              <div className="grid sm:grid-cols-3 gap-2">
                {TYPES.map((t) => {
                  const selected = packingType === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setPackingType(t.id);
                        const available = (detail.items || [])
                          .map((i) => i.sku)
                          .filter((sku) => remainingForSku(sku) > 0);
                        const next =
                          t.id === 3
                            ? available
                            : available.length === 1
                              ? available
                              : [];
                        setSelectedSKUs(next);
                        setTargetQtys((prev) => {
                          const nextQtys = { ...prev };
                          for (const sku of next) {
                            if (!nextQtys[sku]) {
                              nextQtys[sku] = String(remainingForSku(sku));
                            }
                          }
                          return nextQtys;
                        });
                      }}
                      className={`text-left rounded-xl border p-3 ${
                        selected ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : ''
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1 ${
                          selected ? 'text-amber-600' : 'text-slate-400'
                        }`}
                      >
                        {t.icons.map((Icon, i) => (
                          <Icon key={i} size={18} />
                        ))}
                      </div>
                      <div className="mt-1 font-semibold text-sm">{t.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">
                {packingType === 3
                  ? 'Select products & target qty (max = left to allocate; each box = one SKU)'
                  : 'Select product & target qty (max = left to allocate; each box = one SKU)'}
              </div>
              <div className="max-h-56 overflow-auto rounded-xl border divide-y bg-white">
                {(detail.items || []).map((item) => {
                  const rem = remainingForSku(item.sku);
                  const selected = selectedSKUs.includes(item.sku);
                  const exhausted = rem <= 0;
                  return (
                    <div
                      key={item.sku}
                      className={`flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm ${
                        selected
                          ? 'bg-amber-50'
                          : exhausted
                            ? 'opacity-50 bg-slate-50'
                            : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={exhausted}
                        onClick={() => toggleSku(item.sku)}
                        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                      >
                        <span
                          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            selected
                              ? 'border-amber-500 bg-amber-500 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                          aria-hidden
                        >
                          {selected ? '✓' : ''}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-medium truncate">{item.productName}</span>
                          <span className="block font-mono text-xs text-slate-500">
                            {item.sku} · ordered {item.qty} · left to allocate {rem}
                          </span>
                        </span>
                      </button>
                      {selected && (
                        <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-slate-600">
                          Target qty
                          <input
                            type="number"
                            min={1}
                            max={rem}
                            className="w-20 rounded border px-2 py-1 text-right font-mono text-sm"
                            value={targetQtys[item.sku] ?? ''}
                            onChange={(e) =>
                              setTargetQtys((prev) => ({
                                ...prev,
                                [item.sku]: e.target.value,
                              }))
                            }
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-slate-400">/ {rem}</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-between">
              <button
                type="button"
                className="text-sm text-slate-500"
                onClick={() => setCreateSowOpen(false)}
              >
                Back
              </button>
              <button
                disabled={sowBusy}
                className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
              >
                {sowBusy ? 'Creating…' : canPack ? 'Create & open packing' : 'Create SOW'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {open && (
        <Modal title="Create PO" onClose={() => setOpen(false)} wide>
          <form className="space-y-4" onSubmit={createPo}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label className="block text-sm">
                <span className="font-medium">PO Number</span>
                <input
                  className="mt-1 w-full rounded-lg border bg-slate-50 px-3 py-2 font-mono"
                  value={previewPo || 'Will auto-generate'}
                  readOnly
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Client ID</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={clientCode}
                  onChange={(e) => setClientCode(e.target.value)}
                  required
                  autoFocus
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Estimated delivery date</span>
                <input
                  type="date"
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                  value={estimatedDeliveryDate}
                  onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                  required
                />
              </label>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">Producted order</div>
              <div className="space-y-2 max-h-72 overflow-auto">
                {skuOptions.map((opt) => (
                  <div key={opt.sku} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{opt.name}</div>
                      <div className="font-mono text-xs text-slate-500">{opt.sku}</div>
                    </div>
                    <input
                      type="number"
                      min="0"
                      className="w-24 rounded-lg border px-3 py-2 text-right"
                      placeholder="0"
                      value={qtys[opt.sku] ?? ''}
                      onChange={(e) =>
                        setQtys((prev) => ({ ...prev, [opt.sku]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              {productOrderLines.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
                  <span className="text-xs uppercase tracking-wide text-amber-700 font-medium">
                    Preview
                  </span>
                  <div className="mt-2">
                    <ProductOrderList items={productOrderLines} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                disabled={busy}
                className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
              >
                {busy ? 'Saving…' : 'Create PO'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
