import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Package, Plus, LayersArrowUp, ChevronUp, ChevronDown, ChevronsUpDown, Search, X, type LucideIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Modal } from '../components/Modal';
import type { PoClientLookup, ProductName, SkuProgress, Sow } from '../types';

const TYPES: Array<{
  id: 1 | 2 | 3;
  title: string;
  desc: string;
  icons: LucideIcon[];
}> = [
  {
    id: 1,
    title: 'Only box',
    desc: 'Pack into boxes only. Each box holds one SKU. No pallet required.',
    icons: [Package],
  },
  {
    id: 2,
    title: '1 pallet with 1 SKU',
    desc: 'Pallet holds boxes of a single SKU. Each box is still one SKU.',
    icons: [Package, LayersArrowUp],
  },
  {
    id: 3,
    title: '1 pallet with multi SKU',
    desc: 'Pallet may hold boxes of different SKUs. Each box is still one SKU.',
    icons: [Boxes, LayersArrowUp],
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
  const [poProgress, setPoProgress] = useState<SkuProgress[]>([]);
  const [poStatus, setPoStatus] = useState<string>('');
  const [targetQtys, setTargetQtys] = useState<Record<string, string>>({});
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
    setPoProgress([]);
    setPoStatus('');
    setTargetQtys({});
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

  function remainingForSku(sku: string): number {
    const item = poProgress.find((i) => i.sku === sku);
    if (!item) return 0;
    return item.remainingQty ?? Math.max(0, item.orderedQty - item.scannedQty);
  }

  function toggleSku(sku: string) {
    const rem = remainingForSku(sku);
    if (poProgress.length && rem <= 0) {
      toast.error('No remaining quantity for this SKU');
      return;
    }
    setForm((prev) => {
      const has = prev.selectedSKUs.includes(sku);
      if (has) {
        return { ...prev, selectedSKUs: prev.selectedSKUs.filter((s) => s !== sku) };
      }
      if (skuLimit === 1) {
        setTargetQtys((q) => ({ ...q, [sku]: q[sku] || String(rem || 1) }));
        return { ...prev, selectedSKUs: [sku] };
      }
      setTargetQtys((q) => ({ ...q, [sku]: q[sku] || String(rem || 1) }));
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
        setPoProgress([]);
        setPoStatus('');
        setTargetQtys({});
        setForm((prev) => ({ ...prev, sowNumber: '' }));
        return;
      }
      try {
        const [data, sowData] = await Promise.all([
          api<PoClientLookup>(`/api/po-clients/lookup/${encodeURIComponent(po)}`).catch(() => null),
          api<{ sowNumber: string }>(`/api/sows/next-number?poNumber=${encodeURIComponent(po)}`),
        ]);

        const progress = data?.progressItems || [];
        setPoProgress(progress);
        setPoStatus(data?.status || '');

        const availableSkus = progress.length
          ? progress.filter((i) => (i.remainingQty ?? i.orderedQty - i.scannedQty) > 0).map((i) => i.sku)
          : data?.selectedSKUs || [];

        const qtys: Record<string, string> = {};
        for (const item of progress) {
          const rem = item.remainingQty ?? Math.max(0, item.orderedQty - item.scannedQty);
          if (rem > 0) qtys[item.sku] = String(rem);
        }
        setTargetQtys(qtys);

        setForm((prev) => {
          const fromPo = availableSkus;
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
          setPoSkus(availableSkus);
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
        setPoProgress([]);
        setPoStatus('');
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
    if (poStatus === 'fulfilled') {
      toast.error('This PO is fully fulfilled');
      return false;
    }
    for (const sku of form.selectedSKUs) {
      const rem = remainingForSku(sku);
      const qty = Math.floor(Number(targetQtys[sku]));
      if (poProgress.length) {
        if (!Number.isFinite(qty) || qty < 1) {
          toast.error(`Enter a valid target qty for ${sku}`);
          return false;
        }
        if (qty > rem) {
          toast.error(`Target for ${sku} exceeds left to allocate (${rem})`);
          return false;
        }
      }
    }
    return true;
  }

  async function confirmSow() {
    if (!validateSkus()) return;
    setBusy(true);
    try {
      const targetItems = form.selectedSKUs.map((sku) => ({
        sku,
        targetQty: Math.floor(Number(targetQtys[sku])) || remainingForSku(sku) || 1,
      }));
      const data = await api<{ sow: Sow }>('/api/sows', {
        method: 'POST',
        body: { ...form, targetItems },
      });
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

  type SortKey = 'sowNumber' | 'batchNo' | 'poNumber' | 'clientCode' | 'progress' | 'status';
  type SortDir = 'asc' | 'desc';

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'packing' | 'completed'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('sowNumber');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const nameBySku = useMemo(
    () => Object.fromEntries(skuOptions.map((o) => [o.sku, o.name])),
    [skuOptions]
  );

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = sows.filter((sow) => {
      if (statusFilter !== 'all' && sow.status !== statusFilter) return false;
      if (!q) return true;
      const skuNames = (
        sow.selectedSKULabels ||
        sow.selectedSKUs.map((sku) => ({ sku, productName: nameBySku[sku] || sku }))
      )
        .map((x) => `${x.sku} ${x.productName}`)
        .join(' ')
        .toLowerCase();
      return (
        sow.sowNumber.toLowerCase().includes(q) ||
        sow.poNumber.toLowerCase().includes(q) ||
        sow.clientCode.toLowerCase().includes(q) ||
        sow.batchNo.toLowerCase().includes(q) ||
        skuNames.includes(q)
      );
    });

    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'sowNumber') cmp = a.sowNumber.localeCompare(b.sowNumber);
      else if (sortKey === 'batchNo') cmp = a.batchNo.localeCompare(b.batchNo);
      else if (sortKey === 'poNumber') cmp = a.poNumber.localeCompare(b.poNumber);
      else if (sortKey === 'clientCode') cmp = a.clientCode.localeCompare(b.clientCode);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortKey === 'progress') {
        const pctA = a.orderedQty ? (a.scannedQty ?? 0) / a.orderedQty : 0;
        const pctB = b.orderedQty ? (b.scannedQty ?? 0) / b.orderedQty : 0;
        cmp = pctA - pctB;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return filtered;
  }, [sows, search, statusFilter, sortKey, sortDir, nameBySku]);

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
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

      {/* Filter / search bar */}
      <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            className="w-full rounded-lg border bg-white pl-9 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            placeholder="Search SOW, PO, client, SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setSearch('')}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1">
          {(['all', 'packing', 'draft', 'completed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                statusFilter === s
                  ? s === 'all'
                    ? 'bg-slate-800 text-white'
                    : s === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : s === 'packing'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-200 text-slate-700'
                  : 'bg-white border text-slate-600 hover:bg-slate-50'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-400 sm:ml-auto shrink-0">
          {rows.length} / {sows.length} rows
        </div>
      </div>

      <div className="mt-3 bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              {(
                [
                  { key: 'sowNumber', label: 'SOW number' },
                  { key: 'batchNo', label: 'Batch' },
                  { key: 'poNumber', label: 'PO' },
                  { key: 'clientCode', label: 'Client' },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort(key)}
                    className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 hover:bg-slate-200/70 hover:text-slate-900 ${
                      sortKey === key ? 'text-slate-900' : ''
                    }`}
                  >
                    {label}
                    {sortKey === key ? (
                      sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                    ) : (
                      <ChevronsUpDown size={13} className="opacity-40" />
                    )}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">SKU / Product Name</th>
              {(
                [
                  { key: 'progress', label: 'Progress' },
                  { key: 'status', label: 'Status' },
                ] as { key: SortKey; label: string }[]
              ).map(({ key, label }) => (
                <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => handleSort(key)}
                    className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 -mx-1 hover:bg-slate-200/70 hover:text-slate-900 ${
                      sortKey === key ? 'text-slate-900' : ''
                    }`}
                  >
                    {label}
                    {sortKey === key ? (
                      sortDir === 'asc' ? <ChevronUp size={13} /> : <ChevronDown size={13} />
                    ) : (
                      <ChevronsUpDown size={13} className="opacity-40" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  {sows.length === 0 ? 'No SOWs yet. Create one to begin packing.' : 'No results match your filter.'}
                </td>
              </tr>
            )}
            {rows.map((sow) => (
              <tr
                key={sow._id}
                className="border-t hover:bg-amber-50/50 cursor-pointer"
                onClick={() => navigate(`/pack/${sow._id}`)}
              >
                <td className="px-4 py-3 font-medium font-mono whitespace-nowrap">{sow.sowNumber}</td>
                <td className="px-4 py-3 whitespace-nowrap">{sow.batchNo}</td>
                <td className="px-4 py-3 font-mono whitespace-nowrap">{sow.poNumber}</td>
                <td className="px-4 py-3 whitespace-nowrap">{sow.clientCode}</td>
                <td className="px-4 py-3 min-w-[12rem]">
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
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="font-medium">
                    {sow.scannedQty ?? sow.totalAmount ?? 0}
                    {sow.orderedQty != null ? ` / ${sow.orderedQty}` : ''}
                  </div>
                  {sow.orderedQty != null && sow.orderedQty > 0 && (
                    <div className="mt-1 h-1.5 w-24 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${
                          (sow.scannedQty ?? 0) >= sow.orderedQty ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(((sow.scannedQty ?? 0) / sow.orderedQty) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
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
                      ? 'Auto-generated from PO (SOW-{PO#}/{####})'
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
                    const selected = form.packingType === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() =>
                          setForm((prev) => {
                            const available = poSkus.length
                              ? poSkus
                              : skuOptions
                                  .map((o) => o.sku)
                                  .filter((sku) => !poProgress.length || remainingForSku(sku) > 0);
                            const selectedSKUs =
                              t.id === 3
                                ? available
                                : available.length === 1
                                  ? available
                                  : [];
                            setTargetQtys((q) => {
                              const next = { ...q };
                              for (const sku of selectedSKUs) {
                                if (!next[sku]) {
                                  next[sku] = String(remainingForSku(sku) || 1);
                                }
                              }
                              return next;
                            });
                            return {
                              ...prev,
                              packingType: t.id,
                              selectedSKUs,
                            };
                          })
                        }
                        className={`text-left rounded-xl border p-4 transition ${
                          selected
                            ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200'
                            : 'hover:border-slate-300'
                        }`}
                      >
                        <div
                          className={`flex items-center gap-1.5 ${
                            selected ? 'text-amber-600' : 'text-slate-400'
                          }`}
                        >
                          {t.icons.map((Icon, i) => (
                            <Icon key={i} size={20} />
                          ))}
                        </div>
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
                  ? 'Select products from this PO and set a target qty (max = remaining unallocated on the PO). Each box will hold only one SKU.'
                  : 'Select one product from this PO and set a target qty (max = remaining unallocated on the PO). Each box holds only that SKU.'}
              </p>
              {poStatus === 'fulfilled' && (
                <div className="mb-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
                  This PO is fully fulfilled — no remaining quantity to allocate.
                </div>
              )}
              <div className="max-h-72 overflow-auto rounded-xl border divide-y bg-white">
                {skuOptions.map((item) => {
                  const selected = form.selectedSKUs.includes(item.sku);
                  const rem = remainingForSku(item.sku);
                  const hasPoProgress = poProgress.length > 0;
                  const exhausted = hasPoProgress && rem <= 0;
                  const onPo = !hasPoProgress || poProgress.some((p) => p.sku === item.sku);
                  if (hasPoProgress && !onPo) return null;
                  return (
                    <div
                      key={item._id}
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
                        disabled={exhausted || poStatus === 'fulfilled'}
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
                          <span className="block font-medium truncate">{item.name}</span>
                          <span className="block font-mono text-xs text-slate-500">
                            {item.sku}
                            {hasPoProgress ? ` · left to allocate ${rem}` : ''}
                          </span>
                        </span>
                      </button>
                      {selected && (
                        <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-slate-600">
                          Target qty
                          <input
                            type="number"
                            min={1}
                            max={hasPoProgress ? rem : undefined}
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
                          {hasPoProgress && <span className="text-slate-400">/ {rem}</span>}
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex justify-between items-center">
                <button className="text-sm text-slate-500" onClick={() => setStep(1)}>
                  Back
                </button>
                <button
                  disabled={busy || poStatus === 'fulfilled'}
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
