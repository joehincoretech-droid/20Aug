import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Camera, Check, Link2, Package, Save, ScanLine, Unlink } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api.js';
import { Modal } from '../components/Modal.jsx';
import { QrScanner } from '../components/QrScanner.jsx';

export function Packing() {
  const { sowId } = useParams();
  const navigate = useNavigate();
  const productInput = useRef(null);

  const [sow, setSow] = useState(null);
  const [boxes, setBoxes] = useState([]);
  const [pallets, setPallets] = useState([]);
  const [boxId, setBoxId] = useState('');
  const [palletId, setPalletId] = useState('');
  const [productId, setProductId] = useState('');
  const [unknown, setUnknown] = useState(null);
  const [scanner, setScanner] = useState(null);
  const [warnUnlinked, setWarnUnlinked] = useState(null);
  const [busy, setBusy] = useState(false);

  const needsPallet = sow && sow.packingType !== 1;
  const currentBox = boxes.find((b) => b.boxId === boxId);
  const currentPallet = pallets.find((p) => p.palletId === palletId);

  const load = useCallback(async () => {
    const data = await api(`/api/sows/${sowId}`);
    setSow(data.sow);
    setBoxes(data.boxes);
    setPallets(data.pallets);
  }, [sowId]);

  useEffect(() => {
    load().catch((err) => toast.error(err.message));
  }, [load]);

  function focusProductInput() {
    requestAnimationFrame(() => productInput.current?.focus());
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

  async function ensureBox(id) {
    const next = (id || boxId).trim();
    if (!next) {
      toast.error('Enter or scan a Box ID');
      return null;
    }
    const data = await api('/api/packing/boxes', {
      method: 'POST',
      body: { sowId, boxId: next },
    });
    setBoxId(data.box.boxId);
    await load();
    focusProductInput();
    return data.box;
  }

  async function ensurePallet(id) {
    const next = (id || palletId).trim();
    if (!next) {
      toast.error('Enter or scan a Pallet ID');
      return null;
    }
    const data = await api('/api/packing/pallets', {
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
      toast.error(err.message);
    }
  }

  async function unlinkBox(id) {
    try {
      await api('/api/packing/unlink', { method: 'POST', body: { sowId, boxId: id } });
      await load();
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function scanProduct(rawId, extra = {}) {
    const pid = (rawId || productId).trim();
    if (!pid) return;
    try {
      let box = currentBox;
      if (!box) box = await ensureBox();
      if (!box) return;
      await api('/api/packing/scan', {
        method: 'POST',
        body: { sowId, boxId: box.boxId, productId: pid, ...extra },
      });
      setProductId('');
      setUnknown(null);
      await load();
    } catch (err) {
      if (err.data?.code === 'DUPLICATE_PRODUCT') {
        toast.error(`${err.data.productId} have been store in ${err.data.boxId}`, { duration: 3000 });
      } else if (err.data?.code === 'SKU_REQUIRED') {
        setUnknown({ productId: pid });
      } else {
        toast.error(err.message);
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
      toast.error(err.message);
    }
  }

  async function saveProgress() {
    setBusy(true);
    try {
      const data = await api(`/api/sows/${sowId}/save`, { method: 'POST' });
      toast.success(
        `Saved ${data.totalAmount} product(s) in ${data.boxCount} box(es)`
      );
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function finish(force) {
    setBusy(true);
    try {
      await api(`/api/sows/${sowId}/complete`, { method: 'POST' });
      toast.success('Packing completed');
      navigate('/');
    } catch (err) {
      if (err.data?.code === 'UNLINKED_BOXES' && !force) {
        setWarnUnlinked(err.data.unlinkedBoxes);
      } else {
        toast.error(err.message);
      }
    } finally {
      setBusy(false);
    }
  }

  function onScan(value) {
    const target = scanner;
    setScanner(null);
    if (target === 'box') {
      setBoxId(value);
      ensureBox(value).catch((err) => toast.error(err.message));
    } else if (target === 'pallet') {
      setPalletId(value);
      ensurePallet(value).catch((err) => toast.error(err.message));
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
          <InfoItem label="Packed Amount" value={`${totalPacked} product(s)`} />
        </div>
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

      <div className={`grid gap-4 ${needsPallet ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <ScanCard
          title="Box ID"
          hint="QR scan or manual input. Boxes start unlinked."
          value={boxId}
          onChange={setBoxId}
          onCommit={() => ensureBox().catch((e) => toast.error(e.message))}
          onScan={() => setScanner('box')}
          meter={`${boxFill}/30`}
          fill={boxFill / 30}
          disabled={readOnly}
          extra={
            <button
              disabled={readOnly || !currentBox}
              onClick={completeBox}
              className="rounded-lg border px-3 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Complete Box
            </button>
          }
        />
        {needsPallet && (
          <ScanCard
            title="Pallet ID"
            hint="Required for pallet packing types."
            value={palletId}
            onChange={setPalletId}
            onCommit={() => ensurePallet().catch((e) => toast.error(e.message))}
            onScan={() => setScanner('pallet')}
            meter={`${palletFill}/50`}
            fill={palletFill / 50}
            disabled={readOnly}
            extra={
              <div className="flex gap-2">
                <button
                  disabled={readOnly}
                  onClick={linkBox}
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-950 text-white px-3 py-2 text-sm"
                >
                  <Link2 size={14} /> Link Box
                </button>
                {currentBox?.palletId && (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
                    onClick={() => unlinkBox(currentBox.boxId)}
                  >
                    <Unlink size={14} /> Unlink
                  </button>
                )}
              </div>
            }
          />
        )}
        <ScanCard
          title="Product ID"
          hint="Continuous barcode scan or type, then Enter."
          value={productId}
          onChange={setProductId}
          onCommit={() => scanProduct()}
          onScan={() => setScanner('product')}
          inputRef={productInput}
          disabled={readOnly}
          pulse
          extra={
            currentBox ? (
              <div className="text-xs text-slate-500">
                Packing into <span className="font-mono font-medium text-slate-800">{currentBox.boxId}</span>
                {currentBox.palletId ? ` · pallet ${currentBox.palletId}` : ' · unlinked'}
              </div>
            ) : (
              <div className="text-xs text-amber-700">Set a Box ID before scanning products.</div>
            )
          }
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

function InfoItem({ label, value, mono }) {
  return (
    <div className="rounded-xl bg-slate-50 border px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{label}</div>
      <div className={`mt-0.5 font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  );
}

function ScanCard({
  title,
  hint,
  value,
  onChange,
  onCommit,
  onScan,
  meter,
  fill,
  extra,
  inputRef,
  disabled,
  pulse,
}) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        {meter && <div className="text-xs font-mono text-slate-500">({meter})</div>}
      </div>
      <p className="text-xs text-slate-500 mt-1">{hint}</p>
      {typeof fill === 'number' && (
        <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, fill * 100)}%` }} />
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <input
          ref={inputRef}
          disabled={disabled}
          className={`flex-1 rounded-lg border px-3 py-2 font-mono ${pulse ? 'scan-pulse' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onCommit();
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={onScan}
          className="rounded-lg border px-3 hover:bg-slate-50"
          title="Open camera"
        >
          <Camera size={18} />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={onCommit}
          className="rounded-lg bg-amber-500 px-3 text-slate-950"
        >
          <ScanLine size={18} />
        </button>
      </div>
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}

function UnknownForm({ skus, skuLabels, onSave }) {
  const [sku, setSku] = useState(skus[0] || '');
  const [nameOptions, setNameOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  const productName =
    skuLabels.find((x) => x.sku === sku)?.productName ||
    nameOptions.find((x) => x.sku === sku)?.name ||
    '';

  useEffect(() => {
    api('/api/product-names')
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
      onSubmit={(e) => {
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
