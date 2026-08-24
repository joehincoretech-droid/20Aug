import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Check, Link2, Package, Save, ScanLine, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, ApiError } from '../api';
import { Modal } from '../components/Modal';
import { QrScanner } from '../components/QrScanner';
import type { Box, Pallet, ProductName, SkuLabel, Sow } from '../types';

type ScannerTarget = 'box' | 'pallet' | 'product';

export function Packing() {
  const { sowId } = useParams<{ sowId: string }>();
  const navigate = useNavigate();
  const productInput = useRef<HTMLInputElement>(null);

  const [sow, setSow] = useState<Sow | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [pallets, setPallets] = useState<Pallet[]>([]);
  const [boxId, setBoxId] = useState('');
  const [palletId, setPalletId] = useState('');
  const [productId, setProductId] = useState('');
  const [unknown, setUnknown] = useState<{ productId: string } | null>(null);
  const [scanner, setScanner] = useState<ScannerTarget | null>(null);
  const [warnUnlinked, setWarnUnlinked] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const needsPallet = sow && sow.packingType !== 1;
  const currentBox = boxes.find((b) => b.boxId === boxId);
  const currentPallet = pallets.find((p) => p.palletId === palletId);

  const load = useCallback(async () => {
    const data = await api<{ sow: Sow; boxes: Box[]; pallets: Pallet[] }>(`/api/sows/${sowId}`);
    setSow(data.sow);
    setBoxes(data.boxes);
    setPallets(data.pallets);
  }, [sowId]);

  useEffect(() => {
    load().catch((err: Error) => toast.error(err.message));
  }, [load]);

  function focusProductInput() {
    requestAnimationFrame(() => productInput.current?.focus());
  }

  function selectExistingBox(id: string) {
    if (!id) return;
    setBoxId(id);
    const box = boxes.find((b) => b.boxId === id);
    if (box?.palletId) {
      setPalletId(box.palletId);
    }
    if (box && !box.completed) {
      focusProductInput();
    }
  }

  function selectExistingPallet(id: string) {
    if (!id) return;
    setPalletId(id);
  }

  const rows = useMemo(
    () =>
      boxes.flatMap((box) =>
        box.products.map((p) => ({
          ...p,
          boxId: box.boxId,
          palletId: box.palletId || '—',
        }))
      ),
    [boxes]
  );

  async function ensureBox(id?: string) {
    const next = (id || boxId).trim();
    if (!next) {
      toast.error('Enter or scan a Box ID');
      return null;
    }
    const data = await api<{ box: Box }>('/api/packing/boxes', {
      method: 'POST',
      body: { sowId, boxId: next },
    });
    setBoxId(data.box.boxId);
    await load();
    focusProductInput();
    return data.box;
  }

  async function ensurePallet(id?: string) {
    const next = (id || palletId).trim();
    if (!next) {
      toast.error('Enter or scan a Pallet ID');
      return null;
    }
    const data = await api<{ pallet: Pallet }>('/api/packing/pallets', {
      method: 'POST',
      body: { sowId, palletId: next },
    });
    setPalletId(data.pallet.palletId);
    await load();
    return data.pallet;
  }

  async function linkBox() {
    try {
      const box = await ensureBox();
      const pallet = await ensurePallet();
      if (!box || !pallet) return;
      await api('/api/packing/link', {
        method: 'POST',
        body: { sowId, boxId: box.boxId, palletId: pallet.palletId },
      });
      toast.success(`Linked ${box.boxId} → ${pallet.palletId}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  async function unlinkBox(id: string) {
    try {
      await api('/api/packing/unlink', { method: 'POST', body: { sowId, boxId: id } });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  async function scanProduct(rawId?: string, extra: Record<string, unknown> = {}) {
    const pid = (rawId || productId).trim();
    if (!pid) return;
    try {
      let box = currentBox;
      if (!box) box = (await ensureBox()) ?? undefined;
      if (!box) return;
      await api('/api/packing/scan', {
        method: 'POST',
        body: { sowId, boxId: box.boxId, productId: pid, ...extra },
      });
      setProductId('');
      setUnknown(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'DUPLICATE_PRODUCT') {
        toast.error(`${err.data.productId} have been store in ${err.data.boxId}`, { duration: 3000 });
      } else if (err instanceof ApiError && err.data?.code === 'SKU_REQUIRED') {
        setUnknown({ productId: pid });
      } else if (err instanceof ApiError && err.data?.code === 'SOW_QTY_FULL') {
        toast.error(err.message || `SOW target met for ${err.data.sku}`, { duration: 4000 });
      } else if (err instanceof ApiError && err.data?.code === 'PO_QTY_FULL') {
        toast.error(err.message || `PO order met for ${err.data.sku}`, { duration: 4000 });
      } else {
        toast.error(err instanceof Error ? err.message : 'Request failed');
      }
      setProductId('');
    }
  }

  async function completeBox() {
    if (!currentBox) {
      toast.error('No active box');
      return;
    }
    try {
      await api(`/api/packing/boxes/${currentBox.boxId}/complete`, {
        method: 'POST',
        body: { sowId },
      });
      toast.success(`Box ${currentBox.boxId} completed`);
      setBoxId('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    }
  }

  async function saveProgress() {
    setBusy(true);
    try {
      const data = await api<{ totalAmount: number; boxCount: number }>(`/api/sows/${sowId}/save`, {
        method: 'POST',
      });
      toast.success(
        `Saved ${data.totalAmount} product(s) in ${data.boxCount} box(es)`
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function finish(force: boolean) {
    setBusy(true);
    try {
      await api(`/api/sows/${sowId}/complete`, { method: 'POST' });
      toast.success('Packing completed');
      navigate('/');
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'UNLINKED_BOXES' && !force) {
        setWarnUnlinked(err.data.unlinkedBoxes as string[]);
      } else {
        toast.error(err instanceof Error ? err.message : 'Request failed');
      }
    } finally {
      setBusy(false);
    }
  }

  function onScan(value: string) {
    const target = scanner;
    setScanner(null);
    if (target === 'box') {
      setBoxId(value);
      ensureBox(value).catch((err: Error) => toast.error(err.message));
    } else if (target === 'pallet') {
      setPalletId(value);
      ensurePallet(value).catch((err: Error) => toast.error(err.message));
    } else if (target === 'product') {
      scanProduct(value);
    }
  }

  if (!sow) {
    return <div className="p-8 text-slate-500">Loading packing job…</div>;
  }

  const readOnly = sow.status === 'completed';
  const boxFill = currentBox?.products.length || 0;
  const palletFill = currentPallet?.boxes.length || 0;
  const totalPacked = rows.length;

  const hasBox = Boolean(currentBox);
  const hasPallet = Boolean(currentPallet);
  const boxLinked = Boolean(currentBox?.palletId);

  const progressItems = sow.progressItems || [];
  const sowTargetsMet =
    progressItems.length > 0 &&
    progressItems.every((item) => item.orderedQty > 0 && item.scannedQty >= item.orderedQty);
  const metSkus = progressItems.filter(
    (item) => item.orderedQty > 0 && item.scannedQty >= item.orderedQty
  );

  type NextStep = 'box' | 'pallet' | 'link' | 'scan';
  let nextStep: NextStep = 'scan';
  if (!hasBox) nextStep = 'box';
  else if (needsPallet && !hasPallet) nextStep = 'pallet';
  else if (needsPallet && hasPallet && !boxLinked) nextStep = 'link';
  else nextStep = 'scan';

  const nextStepBanner = (() => {
    if (readOnly) {
      return { tone: 'ready' as const, text: 'This SOW is completed — scanning is read-only.' };
    }
    if (sowTargetsMet) {
      const names = metSkus.map((i) => `${i.productName} (${i.scannedQty}/${i.orderedQty})`).join(', ');
      return {
        tone: 'ready' as const,
        text: `SOW targets met: ${names}. Complete box and Finish SOW.`,
      };
    }
    if (currentBox?.completed) {
      return {
        tone: 'blocked' as const,
        text: `Box ${currentBox.boxId} is completed — select or create another box to continue`,
      };
    }
    if (nextStep === 'box') {
      return { tone: 'blocked' as const, text: 'Step 1 — Scan or enter a Box ID to start' };
    }
    if (nextStep === 'pallet') {
      return { tone: 'blocked' as const, text: 'Step 2 — Scan or enter a Pallet ID' };
    }
    if (nextStep === 'link') {
      return { tone: 'blocked' as const, text: 'Step 3 — Link this box to the pallet' };
    }
    const palletPart = currentBox?.palletId
      ? ` · Pallet ${currentBox.palletId}`
      : needsPallet
        ? ' · unlinked'
        : '';
    return {
      tone: 'ready' as const,
      text: `Scanning into ${currentBox!.boxId}${palletPart} · capacity ${boxFill}/30`,
    };
  })();

  const scanDisabled =
    readOnly || !hasBox || Boolean(currentBox?.completed) || sowTargetsMet;

  return (
    <div className="p-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-amber-600">Step 3 · Packing & Scanning</div>
          <h1 className="text-2xl font-semibold mt-1">Packing Job</h1>
        </div>
        <div className="flex gap-2">
          <button
            disabled={readOnly || busy}
            onClick={saveProgress}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            <Save size={18} /> Save
          </button>
          <button
            disabled={readOnly || busy}
            onClick={() => finish(false)}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 font-semibold disabled:opacity-50"
          >
            <Check size={18} /> Finish / Confirm
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">SOW Information</h2>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              sow.status === 'completed'
                ? 'bg-emerald-100 text-emerald-800'
                : sow.status === 'draft'
                  ? 'bg-slate-100 text-slate-700'
                  : 'bg-amber-100 text-amber-800'
            }`}
          >
            {sow.status}
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InfoItem label="SOW Number" value={sow.sowNumber} mono />
          <InfoItem label="PO Number" value={sow.poNumber} mono />
          <InfoItem label="Client ID" value={sow.clientCode} />
          <InfoItem label="Batch NO" value={sow.batchNo} />
          <InfoItem label="Packing Type" value={sow.packingTypeLabel} />
          <InfoItem
            label="Scanned / Target"
            value={
              sow.orderedQty != null
                ? `${totalPacked} / ${sow.orderedQty}`
                : `${totalPacked} product(s)`
            }
          />
        </div>
        {sow.progressItems && sow.progressItems.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
              SOW target progress
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sow.progressItems.map((item) => (
                <div
                  key={item.sku}
                  className="rounded-lg border bg-slate-50 px-3 py-2 text-sm flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{item.productName}</div>
                    <div className="font-mono text-[11px] text-slate-400">{item.sku}</div>
                    {item.poRemaining != null && (
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        PO remaining {item.poRemaining}
                      </div>
                    )}
                  </div>
                  <div
                    className={`font-mono text-sm font-semibold shrink-0 ${
                      item.scannedQty >= item.orderedQty && item.orderedQty > 0
                        ? 'text-emerald-700'
                        : 'text-amber-700'
                    }`}
                  >
                    {item.scannedQty}/{item.orderedQty}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 pt-4 border-t">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
            Selected SKU / Product Name
          </div>
          <div className="flex flex-wrap gap-2">
            {(sow.selectedSKULabels || []).map((item) => (
              <span
                key={item.sku}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-50 border px-3 py-1.5 text-sm"
              >
                <span className="font-mono text-xs text-slate-500">{item.sku}</span>
                <span className="font-medium">{item.productName}</span>
              </span>
            ))}
            {!sow.selectedSKULabels?.length &&
              sow.selectedSKUs.map((sku) => (
                <span key={sku} className="font-mono text-sm rounded-lg bg-slate-50 border px-3 py-1.5">
                  {sku}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div
        className={`rounded-xl border px-4 py-3 text-sm font-medium ${
          nextStepBanner.tone === 'ready'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-amber-50 border-amber-200 text-amber-900'
        }`}
      >
        {nextStepBanner.text}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="lg:col-span-1 bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-slate-800">Container setup</h3>
            <p className="text-xs text-slate-500 mt-0.5">Box first{needsPallet ? ', then pallet & link' : ''}.</p>
          </div>

          <ContainerField
            step={1}
            active={nextStep === 'box'}
            title="Box ID"
            value={boxId}
            onChange={setBoxId}
            onCommit={() => ensureBox().catch((e: Error) => toast.error(e.message))}
            onScan={() => setScanner('box')}
            meter={`${boxFill}/30`}
            fill={boxFill / 30}
            disabled={readOnly}
          />

          {boxes.length > 0 && (
            <label className="block text-xs text-slate-500">
              Select existing box
              <select
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm text-slate-900"
                value={boxes.some((b) => b.boxId === boxId) ? boxId : ''}
                disabled={readOnly}
                onChange={(e) => selectExistingBox(e.target.value)}
              >
                <option value="">Choose a previous box…</option>
                {boxes.map((b) => (
                  <option key={b.boxId} value={b.boxId}>
                    {b.boxId} ({b.products.length}/30)
                    {b.completed ? ' · done' : ''}
                    {b.palletId ? ` · → ${b.palletId}` : ' · unlinked'}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button
            disabled={readOnly || !currentBox}
            onClick={completeBox}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50"
          >
            Complete Box
          </button>

          {needsPallet && (
            <>
              <ContainerField
                step={2}
                active={nextStep === 'pallet'}
                title="Pallet ID"
                value={palletId}
                onChange={setPalletId}
                onCommit={() => ensurePallet().catch((e: Error) => toast.error(e.message))}
                onScan={() => setScanner('pallet')}
                meter={`${palletFill}/50`}
                fill={palletFill / 50}
                disabled={readOnly}
              />

              {pallets.length > 0 && (
                <label className="block text-xs text-slate-500">
                  Select existing pallet
                  <select
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm text-slate-900"
                    value={pallets.some((p) => p.palletId === palletId) ? palletId : ''}
                    disabled={readOnly}
                    onChange={(e) => selectExistingPallet(e.target.value)}
                  >
                    <option value="">Choose a previous pallet…</option>
                    {pallets.map((p) => (
                      <option key={p.palletId} value={p.palletId}>
                        {p.palletId} ({p.boxes.length}/50 boxes)
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {currentBox?.palletId ? (
                  <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-1 text-xs font-medium font-mono">
                    Linked → {currentBox.palletId}
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-900 px-2.5 py-1 text-xs font-medium">
                    Unlinked
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  disabled={readOnly || nextStep === 'box'}
                  onClick={linkBox}
                  className={`inline-flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                    nextStep === 'link'
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-200'
                      : 'bg-slate-950 text-white'
                  }`}
                >
                  <Link2 size={14} /> Link Box
                </button>
                {currentBox?.palletId && (
                  <button
                    disabled={readOnly}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    onClick={() => unlinkBox(currentBox.boxId)}
                  >
                    <Unlink size={14} /> Unlink
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <ProductScanPanel
          step={needsPallet ? 3 : 2}
          active={nextStep === 'scan' && !currentBox?.completed && !sowTargetsMet}
          value={productId}
          onChange={setProductId}
          onCommit={() => scanProduct()}
          onScan={() => setScanner('product')}
          inputRef={productInput}
          disabled={scanDisabled}
          destination={
            currentBox
              ? {
                  boxId: currentBox.boxId,
                  palletId: currentBox.palletId,
                  capacity: `${boxFill}/30`,
                }
              : null
          }
          needsBox={!hasBox}
          boxCompleted={Boolean(currentBox?.completed)}
          targetsMet={sowTargetsMet}
        />
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b font-medium flex items-center gap-2">
          <Package size={16} /> Product table
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Product ID</th>
              <th className="px-4 py-2 font-medium">Product Name</th>
              <th className="px-4 py-2 font-medium">BOX ID</th>
              <th className="px-4 py-2 font-medium">Pallet ID</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Scan products to fill this table.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.boxId}-${row.productId}`} className="border-t">
                <td className="px-4 py-2 font-mono">{row.sku}</td>
                <td className="px-4 py-2 font-mono">{row.productId}</td>
                <td className="px-4 py-2">{row.productName}</td>
                <td className="px-4 py-2 font-mono">{row.boxId}</td>
                <td className="px-4 py-2 font-mono">{row.palletId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {scanner && <QrScanner onResult={onScan} onClose={() => setScanner(null)} />}

      {unknown && (
        <Modal title="Associate SKU" onClose={() => setUnknown(null)}>
          <p className="text-sm text-slate-500 mb-4">
            Product <span className="font-mono">{unknown.productId}</span> is not in the catalog. Choose a
            selected SKU — product name fills automatically.
          </p>
          <UnknownForm
            skus={sow.selectedSKUs}
            skuLabels={sow.selectedSKULabels || []}
            onSave={(payload) => scanProduct(unknown.productId, payload)}
          />
        </Modal>
      )}

      {warnUnlinked && (
        <Modal title="Boxes not linked to a pallet" onClose={() => setWarnUnlinked(null)}>
          <p className="text-sm text-slate-600">
            Option {sow.packingType} requires every box to be linked before submitting. Unlinked boxes:
          </p>
          <ul className="mt-3 font-mono text-sm list-disc pl-5">
            {warnUnlinked.map((id) => (
              <li key={id}>{id}</li>
            ))}
          </ul>
          <div className="mt-5 flex justify-end">
            <button
              className="rounded-lg bg-slate-950 text-white px-4 py-2"
              onClick={() => setWarnUnlinked(null)}
            >
              Go link boxes
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function InfoItem({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string | number | null;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className={`mt-0.5 font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}

function StepBadge({ step, active }: { step: number; active: boolean }) {
  return (
    <span
      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
        active ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-600'
      }`}
    >
      {step}
    </span>
  );
}

function ContainerField({
  step,
  active,
  title,
  value,
  onChange,
  onCommit,
  onScan,
  meter,
  fill,
  disabled,
}: {
  step: number;
  active: boolean;
  title: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onScan: () => void;
  meter: string;
  fill: number;
  disabled?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-white p-3 ${
        active ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StepBadge step={step} active={active} />
          <div className="font-semibold text-sm text-slate-800">{title}</div>
        </div>
        <div className="text-xs font-mono text-slate-500">({meter})</div>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className="h-full bg-amber-500 transition-all" style={{ width: `${Math.min(100, fill * 100)}%` }} />
      </div>
      <div className="mt-2 flex gap-1.5">
        <input
          disabled={disabled}
          className="flex-1 min-w-0 rounded-lg border px-2.5 py-1.5 font-mono text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit();
            }
          }}
          placeholder={title}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onScan}
          className="rounded-lg border px-2.5 hover:bg-slate-50 disabled:opacity-50"
          title="Open camera"
        >
          <Camera size={16} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCommit}
          className="rounded-lg bg-slate-800 px-2.5 text-white disabled:opacity-50"
        >
          <ScanLine size={16} />
        </button>
      </div>
    </div>
  );
}

function ProductScanPanel({
  step,
  active,
  value,
  onChange,
  onCommit,
  onScan,
  inputRef,
  disabled,
  destination,
  needsBox,
  boxCompleted,
  targetsMet,
}: {
  step: number;
  active: boolean;
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onScan: () => void;
  inputRef: RefObject<HTMLInputElement>;
  disabled?: boolean;
  destination: { boxId: string; palletId?: string | null; capacity: string } | null;
  needsBox: boolean;
  boxCompleted?: boolean;
  targetsMet?: boolean;
}) {
  return (
    <section
      className={`lg:col-span-2 rounded-2xl border bg-white p-5 shadow-sm ${
        active ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StepBadge step={step} active={active} />
          <div>
            <h3 className="font-semibold text-lg text-slate-900">Product scanning</h3>
            <p className="text-xs text-slate-500">Continuous barcode scan or type, then Enter</p>
          </div>
        </div>
        {destination && (
          <div className="text-xs font-mono text-slate-500">({destination.capacity})</div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          disabled={disabled}
          className={`flex-1 rounded-xl border-2 px-4 py-3.5 font-mono text-lg ${
            active && !disabled
              ? 'border-amber-400 scan-pulse focus:ring-2 focus:ring-amber-200'
              : 'border-slate-200'
          } disabled:bg-slate-50 disabled:text-slate-400`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit();
            }
          }}
          placeholder={
            needsBox
              ? 'Set a Box ID first…'
              : targetsMet
                ? 'SOW targets met'
                : boxCompleted
                  ? 'This box is completed'
                  : 'Scan or type Product ID'
          }
          autoComplete="off"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onScan}
          className="rounded-xl border px-4 hover:bg-slate-50 disabled:opacity-50"
          title="Open camera"
        >
          <Camera size={22} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCommit}
          className="rounded-xl bg-amber-500 px-4 text-slate-950 font-semibold disabled:opacity-50"
        >
          <ScanLine size={22} />
        </button>
      </div>

      <div className="mt-3">
        {needsBox ? (
          <p className="text-sm text-amber-700">Set a Box ID in Container setup before scanning products.</p>
        ) : targetsMet ? (
          <p className="text-sm text-emerald-700">
            All SOW targets are met. Complete any open box and press Finish / Confirm.
          </p>
        ) : boxCompleted ? (
          <p className="text-sm text-amber-700">
            Box <span className="font-mono font-semibold">{destination?.boxId}</span> is completed.
            Select or create another box to continue scanning.
          </p>
        ) : destination ? (
          <p className="text-sm text-slate-600">
            Packing into{' '}
            <span className="font-mono font-semibold text-slate-900">{destination.boxId}</span>
            {destination.palletId ? (
              <>
                {' '}
                · pallet <span className="font-mono font-semibold">{destination.palletId}</span>
              </>
            ) : (
              <span className="text-amber-700"> · unlinked</span>
            )}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function UnknownForm({
  skus,
  skuLabels,
  onSave,
}: {
  skus: string[];
  skuLabels: SkuLabel[];
  onSave: (payload: { sku: string; productName: string }) => void;
}) {
  const [sku, setSku] = useState(skus[0] || '');
  const [nameOptions, setNameOptions] = useState<ProductName[]>([]);
  const [loading, setLoading] = useState(true);

  const productName =
    skuLabels.find((x) => x.sku === sku)?.productName ||
    nameOptions.find((x) => x.sku === sku)?.name ||
    '';

  useEffect(() => {
    api<{ names: ProductName[] }>('/api/product-names')
      .then((data) => setNameOptions(data.names))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-500">Loading product names…</p>;
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (!productName) {
          toast.error('No product name linked to this SKU');
          return;
        }
        onSave({ sku, productName });
      }}
    >
      <label className="block text-sm">
        SKU / Product Name
        <select
          className="mt-1 w-full rounded-lg border px-3 py-2"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        >
          {skus.map((s) => {
            const label =
              skuLabels.find((x) => x.sku === s)?.productName ||
              nameOptions.find((x) => x.sku === s)?.name ||
              s;
            return (
              <option key={s} value={s}>
                {s} · {label}
              </option>
            );
          })}
        </select>
      </label>
      <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm">
        <div className="text-xs text-slate-400 uppercase tracking-wide">Product name (auto)</div>
        <div className="font-medium mt-0.5">{productName || 'Not linked — ask admin to set SKU ↔ name'}</div>
      </div>
      <button className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-slate-950">Save & pack</button>
    </form>
  );
}
