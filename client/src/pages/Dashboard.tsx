import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Package, Plus, Layers, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { PoClientLookup, ProductName, Sow } from '../types';

const TYPES: Array<{
  id: 1 | 2 | 3;
  title: string;
  desc: string;
  icon: LucideIcon;
}> = [
  {
    id: 1,
    title: 'Box only',
    desc: 'Pack products into boxes. No pallet required.',
    icon: Package,
  },
  {
    id: 2,
    title: 'Only one SKU in one Pallet',
    desc: 'Each pallet holds a single SKU across its boxes.',
    icon: Layers,
  },
  {
    id: 3,
    title: 'More than one SKU in one Pallet',
    desc: 'Boxes of mixed SKUs can share a pallet.',
    icon: Boxes,
  },
];

interface SowForm {
  poNumber: string;
  sowNumber: string;
  batchNo: string;
  clientCode: string;
  packingType: 1 | 2 | 3 | null;
  selectedSKUs: string[];
}

export function Dashboard() {
  const navigate = useNavigate();
  const [sows, setSows] = useState<Sow[]>([]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [skuOptions, setSkuOptions] = useState<ProductName[]>([]);
  const [form, setForm] = useState<SowForm>({
    poNumber: '',
    sowNumber: '',
    batchNo: '',
    clientCode: '',
    packingType: null,
    selectedSKUs: [],
  });
  const [busy, setBusy] = useState(false);
  const [clientAutoFilled, setClientAutoFilled] = useState(false);
  const [poOrder, setPoOrder] = useState('');
  const [poSkus, setPoSkus] = useState<string[]>([]);
  const poLookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    const data = await api<{ sows: Sow[] }>('/api/sows');
    setSows(data.sows);
  }

  useEffect(() => {
    load().catch((err: Error) => toast.error(err.message));
    api<{ names: ProductName[] }>('/api/product-names')
      .then((d) => setSkuOptions(d.names))
      .catch(() => {});
  }, []);

  function resetModal() {
    setStep(1);
    setClientAutoFilled(false);
    setPoOrder('');
    setPoSkus([]);
    setForm({
      poNumber: '',
      sowNumber: '',
      batchNo: '',
      clientCode: '',
      packingType: null,
      selectedSKUs: [],
    });
  }

  const skuLimit = form.packingType === 3 ? Infinity : 1;

  function toggleSku(sku: string) {
    setForm((prev) => {
      const has = prev.selectedSKUs.includes(sku);
      if (has) {
        return { ...prev, selectedSKUs: prev.selectedSKUs.filter((s) => s !== sku) };
      }
      if (skuLimit === 1) {
        return { ...prev, selectedSKUs: [sku] };
      }
      return { ...prev, selectedSKUs: [...prev.selectedSKUs, sku] };
    });
  }

  function onPoChange(value: string) {
    setForm((prev) => ({ ...prev, poNumber: value, sowNumber: '' }));
    if (poLookupTimer.current) clearTimeout(poLookupTimer.current);
    poLookupTimer.current = setTimeout(async () => {
      const po = value.trim();
      if (!po) {
        setClientAutoFilled(false);
        setPoOrder('');
        setPoSkus([]);
        setForm((prev) => ({ ...prev, sowNumber: '' }));
        return;
      }
      try {
        const [data, sowData] = await Promise.all([
          api<PoClientLookup>(`/api/po-clients/lookup/${encodeURIComponent(po)}`).catch(() => null),
          api<{ sowNumber: string }>(`/api/sows/next-number?poNumber=${encodeURIComponent(po)}`),
        ]);

        setForm((prev) => {
          const fromPo = data?.selectedSKUs?.length ? data.selectedSKUs : [];
          let selectedSKUs = fromPo.length ? fromPo : prev.selectedSKUs;
          if (prev.packingType && prev.packingType !== 3 && selectedSKUs.length > 1) {
            selectedSKUs = [];
          } else if (prev.packingType && prev.packingType !== 3 && selectedSKUs.length === 1) {
            selectedSKUs = fromPo.slice(0, 1);
          }
          return {
            ...prev,
            sowNumber: sowData.sowNumber,
            clientCode: data?.clientCode || prev.clientCode,
            selectedSKUs,
          };
        });

        if (data?.clientCode) {
          setClientAutoFilled(true);
          setPoSkus(data.selectedSKUs?.length ? data.selectedSKUs : []);
          setPoOrder(data.productOrder || '');
        } else {
          setClientAutoFilled(false);
          setPoOrder('');
          setPoSkus([]);
        }
      } catch (err) {
        setForm((prev) => ({ ...prev, sowNumber: '' }));
        setClientAutoFilled(false);
        setPoOrder('');
        setPoSkus([]);
        if (po.includes('-')) {
          toast.error(err instanceof Error ? err.message : 'Could not generate SOW number');
        }
      }
    }, 300);
  }

  function validateSkus() {
    if (form.packingType !== 3 && form.selectedSKUs.length !== 1) {
      toast.error('Select exactly 1 SKU');
      return false;
    }
    if (form.packingType === 3 && form.selectedSKUs.length < 2) {
      toast.error('Select multiple SKUs');
      return false;
    }
    return true;
  }

  async function confirmSow() {
    if (!validateSkus()) return;
    setBusy(true);
    try {
      const data = await api<{ sow: Sow }>('/api/sows', { method: 'POST', body: form });
      toast.success('SOW created');
      setOpen(false);
      resetModal();
      await load();
      navigate(`/pack/${data.sow._id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  const rows = useMemo(() => sows, [sows]);
  const nameBySku = useMemo(
    () => Object.fromEntries(skuOptions.map((o) => [o.sku, o.name])),
    [skuOptions]
  );

  return (
    <div className="p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">SOW Dashboard</h1>
          <p className="text-slate-500 mt-1">Create a statement of work and start packing.</p>
        </div>
        <button
          onClick={() => {
            resetModal();
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 hover:bg-amber-400"
        >
          <Plus size={18} /> Create SOW
        </button>
      </div>

      <div className="mt-6 bg-white rounded-2xl border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">SOW</th>
              <th className="px-4 py-3 font-medium">Batch</th>
              <th className="px-4 py-3 font-medium">PO</th>
              <th className="px-4 py-3 font-medium">Client Code</th>
              <th className="px-4 py-3 font-medium">SKU / Product Name</th>
              <th className="px-4 py-3 font-medium">Total Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No SOWs yet. Create one to begin packing.
                </td>
              </tr>
            )}
            {rows.map((sow) => (
              <tr
                key={sow._id}
                className="border-t hover:bg-amber-50/50 cursor-pointer"
                onClick={() => navigate(`/pack/${sow._id}`)}
              >
                <td className="px-4 py-3 font-medium font-mono">{sow.sowNumber}</td>
                <td className="px-4 py-3">{sow.batchNo}</td>
                <td className="px-4 py-3 font-mono">{sow.poNumber}</td>
                <td className="px-4 py-3">{sow.clientCode}</td>
                <td className="px-4 py-3">
                  {(sow.selectedSKULabels || sow.selectedSKUs.map((sku) => ({
                    sku,
                    productName: nameBySku[sku] || sku,
                  }))).map((item) => (
                    <div key={item.sku} className="leading-snug">
                      <span className="font-mono text-xs text-slate-500">{item.sku}</span>
                      <span className="mx-1 text-slate-300">·</span>
                      <span>{item.productName}</span>
                    </div>
                  ))}
                </td>
                <td className="px-4 py-3">{sow.totalAmount}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      sow.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : sow.status === 'draft'
                          ? 'bg-slate-100 text-slate-700'
                          : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {sow.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal
          title={step === 1 ? 'Create SOW' : 'SKU Selection'}
          onClose={() => setOpen(false)}
          wide
        >
          {step === 1 ? (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="PO Number"
                  value={form.poNumber}
                  onChange={onPoChange}
                  hint="Client ID and SOW Number auto-fill from PO"
                />
                <Field
                  label="SOW Number"
                  value={form.sowNumber}
                  readOnly
                  hint={
                    form.sowNumber
                      ? 'Auto-generated from PO (SOW-{PO#}-{####})'
                      : 'Enter a PO number to auto-generate'
                  }
                />
                <Field
                  label="Batch NO"
                  value={form.batchNo}
                  onChange={(v) => setForm({ ...form, batchNo: v })}
                />
                <Field
                  label="Client NO"
                  value={form.clientCode}
                  onChange={(v) => {
                    setClientAutoFilled(false);
                    setForm({ ...form, clientCode: v });
                  }}
                  hint={clientAutoFilled ? 'Auto-filled from PO link' : undefined}
                />
              </div>
              {poOrder && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm">
                  <div className="text-xs uppercase tracking-wide text-amber-700 font-medium">
                    Producted order (from PO)
                  </div>
                  <div className="mt-0.5 font-medium">{poOrder}</div>
                </div>
              )}
              <div>
                <div className="text-sm font-medium mb-2">Packing type</div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {TYPES.map((t) => {
                    const Icon = t.icon;
                    const selected = form.packingType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            packingType: t.id,
                            selectedSKUs:
                              t.id === 3
                                ? poSkus
                                : poSkus.length === 1
                                  ? poSkus
                                  : [],
                          }))
                        }
                        className={`text-left rounded-xl border p-4 transition ${
                          selected
                            ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                            : 'hover:border-slate-300'
                        }`}
                      >
                        <Icon className={selected ? 'text-amber-600' : 'text-slate-400'} />
                        <div className="mt-2 font-semibold text-sm">{t.title}</div>
                        <div className="mt-1 text-xs text-slate-500">{t.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-slate-950 text-white px-4 py-2 font-medium"
                  onClick={() => {
                    if (!form.poNumber || !form.sowNumber || !form.batchNo || !form.clientCode) {
                      toast.error('Fill PO (SOW auto-fills), Batch, and Client');
                      return;
                    }
                    if (!form.packingType) {
                      toast.error('Select a packing type');
                      return;
                    }
                    setStep(2);
                  }}
                >
                  Next: Select SKU
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-slate-500 mb-3">
                {form.packingType === 3
                  ? 'Select multiple SKUs (each SKU is linked to a product name).'
                  : 'Select exactly 1 SKU (linked to its product name).'}
              </p>
              <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-auto">
                {skuOptions.map((item) => {
                  const selected = form.selectedSKUs.includes(item.sku);
                  return (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => toggleSku(item.sku)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm ${
                        selected ? 'border-amber-500 bg-amber-50' : ''
                      }`}
                    >
                      <div className="font-mono text-xs text-slate-500">{item.sku}</div>
                      <div className="font-medium">{item.name}</div>
                    </button>
                  );
                })}
              </div>
              <div className="mt-5 flex justify-between items-center">
                <button className="text-sm text-slate-500" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  disabled={busy}
                  className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950 disabled:opacity-60"
                  onClick={confirmSow}
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
  readOnly,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  hint?: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium">{label}</span>
      <input
        className={`mt-1 w-full rounded-lg border px-3 py-2 ${
          readOnly ? 'bg-slate-50 font-mono text-slate-700' : ''
        }`}
        value={value}
        readOnly={readOnly}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      />
      {hint && <span className="mt-1 block text-xs text-amber-700">{hint}</span>}
    </label>
  );
}
