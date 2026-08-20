import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { api } from '../api.js';
import { Modal } from '../components/Modal.jsx';

export function PurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [skuOptions, setSkuOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientCode, setClientCode] = useState('');
  const [previewPo, setPreviewPo] = useState('');
  const [qtys, setQtys] = useState({});

  async function load() {
    const [poData, skuData] = await Promise.all([
      api('/api/purchase-orders'),
      api('/api/product-names'),
    ]);
    setOrders(poData.orders);
    setSkuOptions(skuData.names);
  }

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, []);

  async function openCreate() {
    setClientCode('');
    setQtys({});
    try {
      const data = await api('/api/purchase-orders/next-number');
      setPreviewPo(data.poNumber);
    } catch {
      setPreviewPo('');
    }
    setOpen(true);
  }

  const lines = useMemo(
    () =>
      skuOptions
        .map((opt) => ({ ...opt, qty: Number(qtys[opt.sku]) || 0 }))
        .filter((opt) => opt.qty > 0),
    [skuOptions, qtys]
  );

  const productOrderPreview = lines.map((l) => `${l.name}*${l.qty}`).join('，');

  async function createPo(e) {
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
      const data = await api('/api/purchase-orders', {
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
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Purchase Orders</h1>
          <p className="text-slate-500 mt-1">Create a PO with Client ID and product quantities. PO number is generated automatically.</p>
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
              <th className="px-4 py-3 font-medium">Created</th>
              <th className="px-4 py-3 font-medium">By</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                  No purchase orders yet.
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr key={order._id} className="border-t align-top">
                <td className="px-4 py-3 font-mono font-medium">{order.poNumber}</td>
                <td className="px-4 py-3">{order.clientCode}</td>
                <td className="px-4 py-3">{order.productOrder || '—'}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {new Date(order.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3">{order.createdBy?.username || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                <span className="mt-1 block text-xs text-slate-500">Generated on save (e.g. PO-1004)</span>
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
              <p className="text-xs text-slate-500 mb-3">Enter quantity for each product. Empty or 0 is skipped.</p>
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
                  <span className="text-xs uppercase tracking-wide text-amber-700 font-medium">Preview</span>
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
