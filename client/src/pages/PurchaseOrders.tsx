import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Boxes, Layers, Package, Plus, type LucideIcon } from 'lucide-react';
import { api } from '../api';
import { Modal } from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import type { ProductName, PurchaseOrder, Sow } from '../types';

const TYPES: Array<{ id: 1 | 2 | 3; title: string; icon: LucideIcon }> = [
  { id: 1, title: 'Box only', icon: Package },
  { id: 2, title: '1 SKU / Pallet', icon: Layers },
  { id: 3, title: 'Multi-SKU / Pallet', icon: Boxes },
];

export function PurchaseOrders() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canPack = user?.role === 'admin' || user?.role === 'worker';

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [skuOptions, setSkuOptions] = useState<ProductName[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientCode, setClientCode] = useState('');
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
      toast.error('This PO is fully fulfilled — no remaining quantity');
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
        toast.error(`Target for ${t.sku} exceeds remaining (${t.rem})`);
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

  const productOrderPreview = lines.map((l) => `${l.name}*${l.qty}`).join('，');

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
    setBusy(true);
    try {
      const data = await api<{ order: PurchaseOrder }>('/api/purchase-orders', {
        method: 'POST',
        body: {
          clientCode: clientCode.trim(),
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

      <div className="mt-6 bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">PO</th>
              <th className="px-4 py-3 font-medium">Client ID</th>
              <th className="px-4 py-3 font-medium">Producted order</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No purchase orders yet.
                </td>
              </tr>
            )}
            {orders.map((order) => {
              const ordered = order.orderedQty ?? 0;
              const scanned = order.scannedQty ?? 0;
              const remaining = order.remainingQty ?? Math.max(0, ordered - scanned);
              const pct = ordered > 0 ? Math.min(100, Math.round((scanned / ordered) * 100)) : 0;
              const fulfilled = order.status === 'fulfilled' || (ordered > 0 && remaining <= 0);
              return (
                <tr
                  key={order._id}
                  className="border-t align-top hover:bg-amber-50/50 cursor-pointer"
                  onClick={() => openOrder(order)}
                >
                  <td className="px-4 py-3 font-mono font-medium">{order.poNumber}</td>
                  <td className="px-4 py-3">{order.clientCode}</td>
                  <td className="px-4 py-3">{order.productOrder || '—'}</td>
                  <td className="px-4 py-3 min-w-[140px]">
                    <div className="font-medium">
                      {scanned}/{ordered}
                      {fulfilled ? (
                        <span className="ml-1 text-[11px] font-medium text-emerald-700">fulfilled</span>
                      ) : (
                        <span className="ml-1 text-[11px] font-normal text-slate-400">
                          · {remaining} left
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
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{order.createdBy?.username || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {detail && !createSowOpen && (
        <Modal title={`PO ${detail.poNumber}`} onClose={() => setDetail(null)} wide>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 border px-3 py-2">
                <div className="text-[11px] uppercase text-slate-400">Client</div>
                <div className="font-semibold">{detail.clientCode}</div>
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
                    <th className="px-3 py-2 font-medium">Remaining</th>
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

            {detail.sowNumbers && detail.sowNumbers.length > 0 && (
              <div className="text-sm text-slate-600">
                Linked SOWs:{' '}
                <span className="font-mono">{detail.sowNumbers.join(', ')}</span>
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
                    ? 'PO is fully fulfilled'
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

            {detail.productOrder && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                <div className="text-xs uppercase tracking-wide text-amber-700 font-medium">
                  Producted order
                </div>
                <div className="mt-0.5 font-medium">{detail.productOrder}</div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium mb-2">Packing type</div>
              <div className="grid sm:grid-cols-3 gap-2">
                {TYPES.map((t) => {
                  const Icon = t.icon;
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
                      <Icon className={selected ? 'text-amber-600' : 'text-slate-400'} size={18} />
                      <div className="mt-1 font-semibold text-sm">{t.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium mb-2">
                {packingType === 3 ? 'Select SKUs & target qty' : 'Select SKU & target qty'}
              </div>
              <div className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-auto">
                {(detail.items || []).map((item) => {
                  const rem = remainingForSku(item.sku);
                  const selected = selectedSKUs.includes(item.sku);
                  const exhausted = rem <= 0;
                  return (
                    <div
                      key={item.sku}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        selected
                          ? 'border-amber-500 bg-amber-50'
                          : exhausted
                            ? 'opacity-50 bg-slate-50'
                            : ''
                      }`}
                    >
                      <button
                        type="button"
                        disabled={exhausted}
                        onClick={() => toggleSku(item.sku)}
                        className="w-full text-left disabled:cursor-not-allowed"
                      >
                        <div className="font-medium">{item.productName}</div>
                        <div className="font-mono text-xs text-slate-500">
                          {item.sku} · ordered {item.qty} · remaining {rem}
                        </div>
                      </button>
                      {selected && (
                        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
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
            <div className="grid sm:grid-cols-2 gap-4">
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
              {productOrderPreview && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                  <span className="text-xs uppercase tracking-wide text-amber-700 font-medium">
                    Preview
                  </span>
                  <div className="mt-0.5 font-medium">{productOrderPreview}</div>
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
