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
import { Camera, Check, Package, Save, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, ApiError } from '../api';
import { Modal } from '../components/Modal';
import { QrScanner } from '../components/QrScanner';
import { useAuth } from '../context/AuthContext';
import type { Box, Pallet, ProductName, SkuLabel, Sow } from '../types';
import { formatDateTime } from '../utils/date';

type ScannerTarget = 'box' | 'pallet' | 'product';

function buildCapacityBySku(labels?: SkuLabel[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const label of labels || []) {
    if (label.boxesPerOuterBox != null && label.boxesPerOuterBox >= 1) {
      map.set(label.sku, label.boxesPerOuterBox);
    }
  }
  return map;
}

function capacityForSku(map: Map<string, number>, sku?: string): number | null {
  if (!sku) return null;
  const cap = map.get(sku);
  return cap != null && cap >= 1 ? cap : null;
}

function capacityForBox(map: Map<string, number>, box?: Box): number | null {
  return capacityForSku(map, box?.products[0]?.sku);
}

function capacityMeter(fill: number, capacity: number | null): string {
  return capacity != null ? `${fill}/${capacity}` : `${fill}/—`;
}

function capacityFillRatio(fill: number, capacity: number | null): number {
  if (!capacity) return 0;
  return Math.min(1, fill / capacity);
}

export function Packing() {
  const { sowId } = useParams<{ sowId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const productInput = useRef<HTMLInputElement>(null);
  const isAdmin = user?.role === 'admin';

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
  /** When true, unknown products auto-use lockedSku — Associate SKU popup is skipped. */
  const [skuLocked, setSkuLocked] = useState(false);
  const [lockedSku, setLockedSku] = useState('');
  const [sowNumberDraft, setSowNumberDraft] = useState('');

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

  useEffect(() => {
    if (sow?.sowNumber) setSowNumberDraft(sow.sowNumber);
  }, [sow?.sowNumber]);

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
    const boxSku = box?.products[0]?.sku;
    if (skuLocked && boxSku && sow?.selectedSKUs.includes(boxSku)) {
      setLockedSku(boxSku);
    }
    if (box && !box.completed) {
      focusProductInput();
    }
  }

  function selectExistingPallet(id: string) {
    if (!id) return;
    setPalletId(id);
    const activeBox = boxes.find((b) => b.boxId === boxId);
    if (activeBox && activeBox.palletId !== id) {
      setBoxId('');
    }
  }

  async function linkBoxToPallet(boxIdToLink: string, palletIdToLink?: string) {
    const pid = (palletIdToLink || palletId).trim();
    const bid = boxIdToLink.trim();
    if (!pid || !bid) return;
    await api('/api/packing/link', {
      method: 'POST',
      body: { sowId, boxId: bid, palletId: pid },
    });
  }

  async function renameSowNumber() {
    const next = sowNumberDraft.trim();
    if (!sow || !next) {
      toast.error('Enter a SOW number');
      return;
    }
    if (next === sow.sowNumber) return;
    setBusy(true);
    try {
      const data = await api<{ sow: Sow }>(`/api/sows/${sowId}/sow-number`, {
        method: 'PATCH',
        body: { sowNumber: next },
      });
      setSow(data.sow);
      setSowNumberDraft(data.sow.sowNumber);
      toast.success('SOW number updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function renameOuterBoxId() {
    if (!currentBox) {
      toast.error('Select an outer box to rename');
      return;
    }
    const next = boxId.trim();
    if (!next) {
      toast.error('Enter a new Outer Box ID');
      return;
    }
    if (next === currentBox.boxId) return;
    setBusy(true);
    try {
      await api('/api/packing/boxes/rename', {
        method: 'PATCH',
        body: { sowId, oldBoxId: currentBox.boxId, newBoxId: next },
      });
      setBoxId(next);
      await load();
      toast.success('Outer Box ID updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function renamePalletIdValue() {
    if (!currentPallet) {
      toast.error('Select a pallet to rename');
      return;
    }
    const next = palletId.trim();
    if (!next) {
      toast.error('Enter a new Pallet ID');
      return;
    }
    if (next === currentPallet.palletId) return;
    setBusy(true);
    try {
      await api('/api/packing/pallets/rename', {
        method: 'PATCH',
        body: { sowId, oldPalletId: currentPallet.palletId, newPalletId: next },
      });
      setPalletId(next);
      await load();
      toast.success('Pallet ID updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }

  async function ensureBox(id?: string) {
    const next = (id || boxId).trim();
    if (!next) {
      toast.error('Enter or scan an Outer Box ID');
      return null;
    }
    const data = await api<{ box: Box }>('/api/packing/boxes', {
      method: 'POST',
      body: { sowId, boxId: next },
    });
    setBoxId(data.box.boxId);
    if (sow && sow.packingType !== 1 && palletId.trim() && data.box.palletId !== palletId.trim()) {
      try {
        await linkBoxToPallet(data.box.boxId);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to link box to pallet');
      }
    }
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

  function resolveSkuName(sku: string): string {
    return (
      sow?.selectedSKULabels?.find((x) => x.sku === sku)?.productName ||
      sow?.progressItems?.find((x) => x.sku === sku)?.productName ||
      ''
    );
  }

  function applyScanLocally(updatedBox: Box, scannedSku: string) {
    setBoxes((prev) => {
      const idx = prev.findIndex((b) => b.boxId === updatedBox.boxId);
      if (idx === -1) return [...prev, updatedBox];
      const next = [...prev];
      next[idx] = updatedBox;
      return next;
    });
    setSow((prev) => {
      if (!prev) return prev;
      const progressItems = (prev.progressItems || []).map((item) => {
        if (item.sku !== scannedSku) return item;
        const scannedQty = item.scannedQty + 1;
        return {
          ...item,
          scannedQty,
          remainingQty:
            item.remainingQty != null ? Math.max(0, item.remainingQty - 1) : undefined,
          poRemaining: item.poRemaining != null ? Math.max(0, item.poRemaining - 1) : undefined,
        };
      });
      return {
        ...prev,
        scannedQty: (prev.scannedQty ?? 0) + 1,
        progressItems,
      };
    });
  }

  async function scanProduct(rawId?: string, extra: Record<string, unknown> = {}) {
    const pid = (rawId || productId).trim();
    if (!pid) return;

    // Send locked SKU on the first request so unknown IDs skip the fail-retry loop
    let bodyExtra = { ...extra };
    if (skuLocked && lockedSku && !bodyExtra.sku) {
      const productName = resolveSkuName(lockedSku);
      if (!productName) {
        toast.error(`No product name for locked SKU ${lockedSku}`);
        return;
      }
      const cap = capacityForSku(buildCapacityBySku(sow?.selectedSKULabels), lockedSku);
      if (cap === null) {
        toast.error(
          `SKU ${lockedSku} has no Boxes/Outer Box configured. Ask admin or PO clerk to set it.`,
          { duration: 5000 }
        );
        return;
      }
      bodyExtra = { ...bodyExtra, sku: lockedSku, productName };
    }

    try {
      let box = currentBox;
      if (!box) box = (await ensureBox()) ?? undefined;
      if (!box) return;

      // Free the input immediately so the next barcode can be entered while the request runs
      setProductId('');
      setUnknown(null);
      focusProductInput();

      const data = await api<{ box: Box; product: { sku: string; productId: string; productName: string } }>(
        '/api/packing/scan',
        {
          method: 'POST',
          body: { sowId, boxId: box.boxId, productId: pid, ...bodyExtra },
        }
      );

      applyScanLocally(data.box, data.product.sku);
      focusProductInput();
    } catch (err) {
      if (err instanceof ApiError && err.data?.code === 'DUPLICATE_PRODUCT') {
        toast.error(`${err.data.productId} have been store in ${err.data.boxId}`, { duration: 3000 });
      } else if (err instanceof ApiError && err.data?.code === 'SKU_REQUIRED') {
        setUnknown({ productId: pid });
      } else if (err instanceof ApiError && err.data?.code === 'SOW_QTY_FULL') {
        toast.error(err.message || `SOW target met for ${err.data.sku}`, { duration: 4000 });
      } else if (err instanceof ApiError && err.data?.code === 'PO_QTY_FULL') {
        toast.error(err.message || `PO order met for ${err.data.sku}`, { duration: 4000 });
      } else if (err instanceof ApiError && err.data?.code === 'MIXED_SKU_BOX') {
        toast.error(
          err.message ||
            `Box already contains ${err.data.existingSku}. One box = one SKU.`,
          { duration: 4000 }
        );
      } else if (err instanceof ApiError && err.data?.code === 'BOX_CAPACITY_NOT_SET') {
        toast.error(err.message || 'SKU has no Boxes/Outer Box configured.', { duration: 5000 });
      } else {
        toast.error(err instanceof Error ? err.message : 'Request failed');
      }
      setProductId('');
      focusProductInput();
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
      navigate('/sow');
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

  const rows = useMemo(() => {
    const boxOnlyMode = sow?.packingType === 1;
    const isPalletMode = sow?.packingType === 2 || sow?.packingType === 3;
    const source = boxId
      ? boxes.filter((b) => b.boxId === boxId)
      : boxOnlyMode || isPalletMode
        ? []
        : boxes;
    return source.flatMap((box) =>
      box.products.map((p) => ({
        ...p,
        boxId: box.boxId,
        palletId: box.palletId || '—',
      }))
    );
  }, [boxes, boxId, sow?.packingType]);

  const allProductCount = useMemo(
    () => boxes.reduce((n, b) => n + b.products.length, 0),
    [boxes]
  );

  const boxesOnPallet = useMemo(
    () => (palletId ? boxes.filter((b) => b.palletId === palletId) : []),
    [boxes, palletId]
  );

  if (!sow) {
    return <div className="p-8 text-slate-500">Loading packing job…</div>;
  }

  const readOnly = sow.status === 'completed';
  const boxFill = currentBox?.products.length || 0;
  const palletFill = currentPallet?.boxes.length || 0;
  const totalPacked = allProductCount;
  const boxOnly = sow.packingType === 1;
  const palletMode = sow.packingType === 2 || sow.packingType === 3;
  const capacityBySku = buildCapacityBySku(sow.selectedSKULabels);
  const boxCapacity =
    capacityForBox(capacityBySku, currentBox) ??
    (skuLocked ? capacityForSku(capacityBySku, lockedSku) : null);
  const lockedSkuMissingCapacity =
    skuLocked && Boolean(lockedSku) && capacityForSku(capacityBySku, lockedSku) === null;
  const boxAtCapacity = boxCapacity != null && boxFill >= boxCapacity;

  const hasBox = Boolean(currentBox);
  const hasPallet = Boolean(currentPallet);

  const progressItems = sow.progressItems || [];
  const sowTargetsMet =
    progressItems.length > 0 &&
    progressItems.every((item) => item.orderedQty > 0 && item.scannedQty >= item.orderedQty);
  const metSkus = progressItems.filter(
    (item) => item.orderedQty > 0 && item.scannedQty >= item.orderedQty
  );

  type NextStep = 'box' | 'pallet' | 'scan';
  let nextStep: NextStep = 'scan';
  if (palletMode) {
    if (!hasPallet) nextStep = 'pallet';
    else if (!hasBox) nextStep = 'box';
    else nextStep = 'scan';
  } else if (!hasBox) {
    nextStep = 'box';
  } else {
    nextStep = 'scan';
  }

  const nextStepBanner = (() => {
    if (readOnly) {
      return {
        tone: 'ready' as const,
        text: 'This SOW is completed — select a pallet and box below to review packed products.',
      };
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
      return {
        tone: 'blocked' as const,
        text: palletMode
          ? `Scan or enter an Outer Box ID for pallet ${palletId}`
          : 'Step 1 — Scan or enter an Outer Box ID to start',
      };
    }
    if (nextStep === 'pallet') {
      return { tone: 'blocked' as const, text: 'Scan or enter a Pallet ID to start' };
    }
    if (lockedSkuMissingCapacity) {
      return {
        tone: 'blocked' as const,
        text: `Locked SKU ${lockedSku} has no Boxes/Outer Box configured. Ask admin or PO clerk to set it.`,
      };
    }
    const palletPart = palletMode && palletId ? ` · Pallet ${palletId}` : '';
    const capLabel = boxCapacity != null ? String(boxCapacity) : '—';
    return {
      tone: 'ready' as const,
      text: `Scanning into ${currentBox!.boxId}${palletPart} · capacity ${boxFill}/${capLabel}`,
    };
  })();

  const scanDisabled =
    readOnly ||
    !hasBox ||
    Boolean(currentBox?.completed) ||
    sowTargetsMet ||
    lockedSkuMissingCapacity ||
    boxAtCapacity ||
    (palletMode && (!hasPallet || currentBox?.palletId !== palletId));

  const canCompleteBox =
    !readOnly &&
    Boolean(currentBox) &&
    !currentBox?.completed &&
    ((boxCapacity != null && boxFill >= boxCapacity) || sowTargetsMet);

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
            disabled={readOnly || busy || !sowTargetsMet}
            onClick={() => finish(false)}
            title={
              readOnly
                ? 'SOW already completed'
                : !sowTargetsMet
                  ? 'Finish when all SOW target progress is met'
                  : 'Finish / confirm this SOW'
            }
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 font-semibold disabled:opacity-50 disabled:cursor-not-allowed ${
              !readOnly && sowTargetsMet
                ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                : 'bg-slate-300 text-slate-500'
            }`}
          >
            <Check size={18} /> Finish
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
          {isAdmin ? (
            <EditableInfoItem
              label="SOW Number"
              value={sowNumberDraft}
              onChange={setSowNumberDraft}
              onSave={renameSowNumber}
              canSave={sowNumberDraft.trim() !== sow.sowNumber && !busy}
              mono
            />
          ) : (
            <InfoItem label="SOW Number" value={sow.sowNumber} mono />
          )}
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
            <ul className="max-h-40 overflow-auto rounded-xl border divide-y bg-slate-50">
              {sow.progressItems.map((item) => {
                const done = item.orderedQty > 0 && item.scannedQty >= item.orderedQty;
                return (
                  <li
                    key={item.sku}
                    className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
                  >
                    <div className="min-w-0 flex items-baseline gap-2 truncate">
                      <span className="font-medium truncate">{item.productName}</span>
                      <span className="font-mono text-[11px] text-slate-400 shrink-0">{item.sku}</span>
                      {item.poRemaining != null && (
                        <span className="text-[11px] text-slate-400 shrink-0">
                          · PO left {item.poRemaining}
                        </span>
                      )}
                    </div>
                    <span
                      className={`font-mono text-sm font-semibold shrink-0 ${
                        done ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {item.scannedQty}/{item.orderedQty}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <section className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
          {boxOnly ? (
            <>
              <div>
                <h3 className="font-semibold text-slate-800">Box scanning</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan or enter an Outer Box ID. Select a box below to pack and view its products.
                </p>
              </div>

              <ContainerField
                step={1}
                active={nextStep === 'box'}
                title="Outer Box ID"
                value={boxId}
                onChange={setBoxId}
                onCommit={() => ensureBox().catch((e: Error) => toast.error(e.message))}
                onScan={() => setScanner('box')}
                meter={currentBox ? capacityMeter(boxFill, boxCapacity) : '—/—'}
                fill={currentBox ? capacityFillRatio(boxFill, boxCapacity) : 0}
                disabled={readOnly}
                inputDisabled={readOnly && !isAdmin}
                renameEnabled={
                  isAdmin &&
                  Boolean(currentBox) &&
                  boxId.trim() !== '' &&
                  boxId.trim() !== currentBox?.boxId
                }
                onRename={() => renameOuterBoxId().catch((e: Error) => toast.error(e.message))}
                renameBusy={busy}
              />

              {boxes.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1.5">Boxes on this SOW</div>
                  <ul className="max-h-48 overflow-auto rounded-xl border bg-white divide-y">
                    {boxes.map((b) => {
                      const active = b.boxId === boxId;
                      const fill = b.products.length;
                      const boxCap = capacityForBox(capacityBySku, b);
                      return (
                        <li key={b.boxId}>
                          <button
                            type="button"
                            onClick={() => selectExistingBox(b.boxId)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-mono ${
                              active
                                ? 'bg-amber-50 text-amber-950 ring-inset ring-2 ring-amber-400'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <span className="font-semibold truncate">
                              {b.boxId}
                              <span className="font-normal text-slate-500">
                                {' '}
                                ({capacityMeter(fill, boxCap)})
                              </span>
                            </span>
                            {b.completed && (
                              <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-sans font-medium">
                                done
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              <button
                disabled={!canCompleteBox}
                onClick={completeBox}
                className={`w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                  canCompleteBox
                    ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                    : 'border border-slate-300 bg-white hover:bg-slate-100'
                }`}
              >
                Complete Box
                {canCompleteBox && boxCapacity != null && boxFill >= boxCapacity
                  ? ' · full'
                  : canCompleteBox && sowTargetsMet
                    ? ' · SOW done'
                    : ''}
              </button>
            </>
          ) : (
            <>
              <div>
                <h3 className="font-semibold text-slate-800">Pallet scanning</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Scan a pallet, then scan boxes onto it. Select a box to pack and view its products.
                </p>
              </div>

              <ContainerField
                step={1}
                active={nextStep === 'pallet'}
                title="Pallet ID"
                value={palletId}
                onChange={setPalletId}
                onCommit={() => ensurePallet().catch((e: Error) => toast.error(e.message))}
                onScan={() => setScanner('pallet')}
                meter={hasPallet ? `${palletFill}/50` : '—/50'}
                fill={hasPallet ? palletFill / 50 : 0}
                disabled={readOnly}
                inputDisabled={readOnly && !isAdmin}
                renameEnabled={
                  isAdmin &&
                  Boolean(currentPallet) &&
                  palletId.trim() !== '' &&
                  palletId.trim() !== currentPallet?.palletId
                }
                onRename={() => renamePalletIdValue().catch((e: Error) => toast.error(e.message))}
                renameBusy={busy}
              />

              {pallets.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1.5">Pallets on this SOW</div>
                  <ul className="max-h-36 overflow-auto rounded-xl border bg-white divide-y">
                    {pallets.map((p) => {
                      const active = p.palletId === palletId;
                      return (
                        <li key={p.palletId}>
                          <button
                            type="button"
                            onClick={() => selectExistingPallet(p.palletId)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-mono ${
                              active
                                ? 'bg-amber-50 text-amber-950 ring-inset ring-2 ring-amber-400'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <span className="font-semibold truncate">
                              {p.palletId}
                              <span className="font-normal text-slate-500">
                                {' '}
                                ({p.boxes.length}/50)
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {hasPallet && (
                <>
                  <ContainerField
                    step={2}
                    active={nextStep === 'box'}
                    title="Outer Box ID"
                    value={boxId}
                    onChange={setBoxId}
                    onCommit={() => ensureBox().catch((e: Error) => toast.error(e.message))}
                    onScan={() => setScanner('box')}
                    meter={currentBox ? capacityMeter(boxFill, boxCapacity) : '—/—'}
                    fill={currentBox ? capacityFillRatio(boxFill, boxCapacity) : 0}
                    disabled={readOnly}
                    inputDisabled={readOnly && !isAdmin}
                    renameEnabled={
                      isAdmin &&
                      Boolean(currentBox) &&
                      boxId.trim() !== '' &&
                      boxId.trim() !== currentBox?.boxId
                    }
                    onRename={() => renameOuterBoxId().catch((e: Error) => toast.error(e.message))}
                    renameBusy={busy}
                  />

                  <div>
                    <div className="text-xs font-medium text-slate-500 mb-1.5">
                      Boxes on {palletId}
                    </div>
                    <ul className="max-h-48 overflow-auto rounded-xl border bg-white divide-y">
                        {boxesOnPallet.map((b) => {
                          const active = b.boxId === boxId;
                          const fill = b.products.length;
                      const boxCap = capacityForBox(capacityBySku, b);
                          return (
                            <li key={b.boxId}>
                              <button
                                type="button"
                                onClick={() => selectExistingBox(b.boxId)}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-mono ${
                                  active
                                    ? 'bg-amber-50 text-amber-950 ring-inset ring-2 ring-amber-400'
                                    : 'hover:bg-slate-50 text-slate-800'
                                }`}
                              >
                                <span className="font-semibold truncate">
                                  {b.boxId}
                                  <span className="font-normal text-slate-500">
                                {' '}
                                ({capacityMeter(fill, boxCap)})
                              </span>
                                </span>
                                {b.completed && (
                                  <span className="shrink-0 rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-sans font-medium">
                                    done
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })}
                        {boxesOnPallet.length === 0 && (
                          <li className="px-3 py-4 text-center text-xs text-slate-400">
                            No boxes on this pallet yet — scan an Outer Box ID above.
                          </li>
                        )}
                      </ul>
                    </div>

                  <button
                    disabled={!canCompleteBox}
                    onClick={completeBox}
                    className={`w-full rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50 ${
                      canCompleteBox
                        ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                        : 'border border-slate-300 bg-white hover:bg-slate-100'
                    }`}
                  >
                    Complete Box
                    {canCompleteBox && boxCapacity != null && boxFill >= boxCapacity
                      ? ' · full'
                      : canCompleteBox && sowTargetsMet
                        ? ' · SOW done'
                        : ''}
                  </button>
                </>
              )}
            </>
          )}
        </section>

        <div
          className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
            nextStep === 'scan' && !currentBox?.completed && !sowTargetsMet
              ? 'ring-2 ring-amber-100 border-amber-300'
              : ''
          }`}
        >
          <div className="px-4 py-3 border-b space-y-3">
            <div className="font-medium flex flex-wrap items-center gap-2">
              <Package size={16} /> Product table
              {currentBox ? (
                <span className="text-sm font-normal text-slate-500 font-mono">
                  {palletMode && palletId ? `· ${palletId} · ` : '· '}
                  {currentBox.boxId} ({capacityMeter(boxFill, boxCapacity)})
                </span>
              ) : palletMode && hasPallet ? (
                <span className="text-sm font-normal text-slate-400">
                  · select a box on {palletId}
                </span>
              ) : boxes.length > 0 || (palletMode && pallets.length > 0) ? (
                <span className="text-sm font-normal text-slate-400">
                  · {palletMode ? 'select a pallet, then a box' : 'select a box to filter'}
                </span>
              ) : null}
            </div>

            <ProductScanBar
              step={palletMode ? 3 : 2}
              active={nextStep === 'scan' && !currentBox?.completed && !sowTargetsMet}
              value={productId}
              onChange={setProductId}
              onCommit={() => scanProduct()}
              onScan={() => setScanner('product')}
              inputRef={productInput}
              disabled={scanDisabled}
              needsBox={!hasBox}
              boxCompleted={Boolean(currentBox?.completed)}
              targetsMet={sowTargetsMet}
            />

            <label
              className={`flex flex-wrap items-center gap-2 text-sm ${
                readOnly ? 'opacity-50' : ''
              }`}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                checked={skuLocked}
                disabled={readOnly || sow.selectedSKUs.length === 0}
                onChange={(e) => {
                  const on = e.target.checked;
                  setSkuLocked(on);
                  if (on) {
                    const boxSku = currentBox?.products[0]?.sku;
                    const next =
                      (boxSku && sow.selectedSKUs.includes(boxSku) && boxSku) ||
                      lockedSku ||
                      sow.selectedSKUs[0] ||
                      '';
                    setLockedSku(next);
                    setUnknown(null);
                  }
                }}
              />
              <span className="font-medium text-slate-700">Lock SKU for continuous scan</span>
              {skuLocked ? (
                <select
                  className="rounded-lg border bg-white px-2 py-1 font-mono text-xs max-w-full"
                  value={lockedSku}
                  disabled={readOnly}
                  onChange={(e) => setLockedSku(e.target.value)}
                >
                  {sow.selectedSKUs.map((sku) => {
                    const name =
                      sow.selectedSKULabels?.find((x) => x.sku === sku)?.productName || sku;
                    return (
                      <option key={sku} value={sku}>
                        {sku} · {name}
                      </option>
                    );
                  })}
                </select>
              ) : (
                <span className="text-xs text-slate-400">
                  Off — unknown products will ask to associate SKU
                </span>
              )}
            </label>
          </div>
          <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">SKU</th>
              <th className="px-4 py-2 font-medium">Product ID</th>
              <th className="px-4 py-2 font-medium">Product Name</th>
              <th className="px-4 py-2 font-medium whitespace-nowrap">Packed at</th>
              <th className="px-4 py-2 font-medium">Outer Box ID</th>
              {!boxOnly && <th className="px-4 py-2 font-medium">Pallet ID</th>}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={boxOnly ? 5 : 6} className="px-4 py-8 text-center text-slate-400">
                  {palletMode && !hasPallet
                    ? 'Scan a Pallet ID first.'
                    : boxId && !currentBox
                      ? 'Scan or create this Outer Box ID first.'
                      : currentBox
                        ? 'No products in this box yet. Scan products to fill it.'
                        : palletMode
                          ? `Select a box on ${palletId} to view products.`
                          : boxes.length
                            ? 'Select a box above to view its products.'
                            : 'Scan an Outer Box ID, then scan products.'}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={`${row.boxId}-${row.productId}`} className="border-t">
                <td className="px-4 py-2 font-mono">{row.sku}</td>
                <td className="px-4 py-2 font-mono">{row.productId}</td>
                <td className="px-4 py-2">{row.productName}</td>
                <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">
                  {formatDateTime(row.packedAt)}
                </td>
                <td className="px-4 py-2 font-mono">{row.boxId}</td>
                {!boxOnly && <td className="px-4 py-2 font-mono">{row.palletId}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
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

function EditableInfoItem({
  label,
  value,
  onChange,
  onSave,
  canSave,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  canSave: boolean;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className="mt-1.5 flex gap-2">
        <input
          className={`flex-1 min-w-0 rounded-lg border bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-900 ${
            mono ? 'font-mono' : ''
          }`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (canSave) onSave();
            }
          }}
        />
        <button
          type="button"
          disabled={!canSave}
          onClick={onSave}
          className="shrink-0 rounded-lg bg-slate-800 px-2.5 text-white disabled:opacity-40"
          title="Save SOW number"
        >
          <Save size={16} />
        </button>
      </div>
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
  inputDisabled,
  renameEnabled,
  onRename,
  renameBusy,
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
  inputDisabled?: boolean;
  renameEnabled?: boolean;
  onRename?: () => void;
  renameBusy?: boolean;
}) {
  const fieldDisabled = inputDisabled ?? disabled;
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
          disabled={fieldDisabled}
          className="flex-1 min-w-0 rounded-lg border px-2.5 py-1.5 font-mono text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (renameEnabled && onRename) onRename();
              else if (!disabled) onCommit();
            }
          }}
          placeholder={title}
        />
        {renameEnabled && onRename && (
          <button
            type="button"
            disabled={renameBusy}
            onClick={onRename}
            className="rounded-lg bg-blue-600 px-2.5 text-white disabled:opacity-50"
            title={`Save ${title}`}
          >
            <Save size={16} />
          </button>
        )}
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

function ProductScanBar({
  step,
  active,
  value,
  onChange,
  onCommit,
  onScan,
  inputRef,
  disabled,
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
  needsBox: boolean;
  boxCompleted?: boolean;
  targetsMet?: boolean;
}) {
  const placeholder = needsBox
    ? 'Set an Outer Box ID first…'
    : targetsMet
      ? 'SOW targets met'
      : boxCompleted
        ? 'This box is completed'
        : 'Scan or type Product ID';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StepBadge step={step} active={active} />
      <span className="text-xs font-medium text-slate-500 shrink-0">Product scan</span>
      <input
        ref={inputRef}
        disabled={disabled}
        className={`min-w-[12rem] flex-1 rounded-lg border px-3 py-2 font-mono text-sm ${
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
        placeholder={placeholder}
        autoComplete="off"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={onScan}
        className="rounded-lg border px-2.5 py-2 hover:bg-slate-50 disabled:opacity-50"
        title="Open camera"
      >
        <Camera size={16} />
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onCommit}
        className="rounded-lg bg-amber-500 px-2.5 py-2 text-slate-950 disabled:opacity-50"
        title="Scan product"
      >
        <ScanLine size={16} />
      </button>
    </div>
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
