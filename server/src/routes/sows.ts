import { Router, type Request, type Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { Sow, type ISow, type SowDocument } from '../models/Sow.js';
import { Box } from '../models/Box.js';
import { Pallet } from '../models/Pallet.js';
import { PoClient } from '../models/PoClient.js';
import { ProductNameOption } from '../models/ProductNameOption.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import {
  remainingBySkuForPo,
  resolveTargetItems,
  scannedBySkuForSow,
  syncPoStatus,
} from '../utils/poProgress.js';

export const sowsRouter = Router();

sowsRouter.use(authRequired);

function packingTypeLabel(type: number): string {
  if (type === 1) return 'Only box';
  if (type === 2) return '1 pallet with one SKU';
  if (type === 3) return '1 pallet with multi SKU';
  return 'Unknown';
}

/** PO-1234 → 1234 (value after first "-") */
function poSuffix(poNumber: string): string {
  const po = String(poNumber || '').trim();
  const idx = po.indexOf('-');
  if (idx === -1 || idx === po.length - 1) return po;
  return po.slice(idx + 1);
}

async function nextSowNumber(poNumber: string): Promise<string> {
  const suffix = poSuffix(poNumber);
  if (!suffix) {
    throw Object.assign(new Error('Invalid PO number'), { status: 400 });
  }
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match both legacy SOW-1001-0001 and new SOW-1001/0001
  const existing = await Sow.find({
    poNumber: String(poNumber).trim(),
    sowNumber: new RegExp(`^SOW-${escaped}[-/]\\d{4}$`),
  }).select('sowNumber');

  let max = 0;
  for (const sow of existing) {
    const match = String(sow.sowNumber).match(/[-/](\d{4})$/);
    if (match) {
      const seq = Number(match[1]);
      if (Number.isFinite(seq)) max = Math.max(max, seq);
    }
  }
  return `SOW-${suffix}/${String(max + 1).padStart(4, '0')}`;
}

async function skuOptionMaps(): Promise<{
  namesBySku: Map<string, string>;
  capacityBySku: Map<string, number>;
}> {
  const options = await ProductNameOption.find();
  return {
    namesBySku: new Map(options.map((o) => [o.sku, o.name])),
    capacityBySku: new Map(
      options
        .filter((o) => o.boxesPerOuterBox != null && o.boxesPerOuterBox >= 1)
        .map((o) => [o.sku, o.boxesPerOuterBox])
    ),
  };
}

async function withTotals(sows: SowDocument[]) {
  const ids = sows.map((s) => s._id);
  const boxes = await Box.find({ sowId: { $in: ids } });
  const { namesBySku, capacityBySku } = await skuOptionMaps();
  const bySow = new Map<string, { totalAmount: number; boxCount: number; bySku: Map<string, number> }>();
  for (const box of boxes) {
    const key = String(box.sowId);
    const prev = bySow.get(key) || { totalAmount: 0, boxCount: 0, bySku: new Map() };
    prev.totalAmount += box.products.length;
    prev.boxCount += 1;
    for (const p of box.products) {
      prev.bySku.set(p.sku, (prev.bySku.get(p.sku) || 0) + 1);
    }
    bySow.set(key, prev);
  }

  const poNumbers = [...new Set(sows.map((s) => s.poNumber).filter(Boolean))];
  const pos = await PurchaseOrder.find({ poNumber: { $in: poNumbers } });
  const poByNumber = new Map(pos.map((p) => [p.poNumber, p]));

  const remainingByPo = new Map<string, Map<string, number>>();
  await Promise.all(
    pos.map(async (po) => {
      remainingByPo.set(po.poNumber, await remainingBySkuForPo(po.poNumber, po.items || []));
    })
  );

  return sows.map((sow) => {
    const stats = bySow.get(String(sow._id)) || {
      totalAmount: 0,
      boxCount: 0,
      bySku: new Map<string, number>(),
    };
    const selectedSKULabels = (sow.selectedSKUs || []).map((sku) => ({
      sku,
      productName: namesBySku.get(sku) || sku,
      boxesPerOuterBox: capacityBySku.get(sku),
    }));
    const po = poByNumber.get(sow.poNumber);
    const poItems = po?.items || [];
    const targets = resolveTargetItems(sow, poItems);
    const remaining = remainingByPo.get(sow.poNumber) || new Map<string, number>();
    const progressItems = targets.map((t) => ({
      sku: t.sku,
      productName: t.productName,
      orderedQty: t.targetQty,
      scannedQty: stats.bySku.get(t.sku) || 0,
      poRemaining: remaining.get(t.sku) ?? 0,
    }));
    const orderedQty = targets.reduce((n, t) => n + t.targetQty, 0);
    return {
      ...sow.toObject(),
      targetItems: targets,
      packingTypeLabel: packingTypeLabel(sow.packingType),
      totalAmount: stats.totalAmount,
      scannedQty: stats.totalAmount,
      orderedQty: targets.length ? orderedQty : null,
      boxCount: stats.boxCount,
      selectedSKULabels,
      progressItems,
      productOrder: poItems.map((i) => `${i.productName}*${i.qty}`).join('，') || '',
    };
  });
}

sowsRouter.get('/', requireRole('admin', 'worker'), async (req: Request, res: Response) => {
  const { status } = req.query;
  const filter: FilterQuery<ISow> = {};
  if (status) filter.status = status as string;
  const sows = await Sow.find(filter).sort({ createdAt: -1 }).populate('createdBy', 'username role');
  res.json({ sows: await withTotals(sows as SowDocument[]) });
});

sowsRouter.get('/history', authRequired, requireRole('admin'), async (_req: Request, res: Response) => {
  const sows = await Sow.find({ status: 'completed' })
    .sort({ completedAt: -1 })
    .populate('createdBy', 'username')
    .populate('completedBy', 'username');
  const withStats = await withTotals(sows as SowDocument[]);
  const boxes = await Box.find({ sowId: { $in: sows.map((s) => s._id) } });
  const pallets = await Pallet.find({ sowId: { $in: sows.map((s) => s._id) } });
  res.json({ sows: withStats, boxes, pallets });
});

sowsRouter.get('/next-number', requireRole('admin', 'worker', 'po'), async (req: Request, res: Response) => {
  const poNumber = String(req.query.poNumber || '').trim();
  if (!poNumber) {
    return res.status(400).json({ message: 'poNumber is required' });
  }
  try {
    const sowNumber = await nextSowNumber(poNumber);
    res.json({ sowNumber, poNumber, poSuffix: poSuffix(poNumber) });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status || 500).json({ message: e.message || 'Failed to generate SOW number' });
  }
});

sowsRouter.get('/:id', requireRole('admin', 'worker'), async (req: Request, res: Response) => {
  const sow = await Sow.findById(req.params.id);
  if (!sow) return res.status(404).json({ message: 'SOW not found' });
  const boxes = await Box.find({ sowId: sow._id }).sort({ createdAt: 1 });
  const pallets = await Pallet.find({ sowId: sow._id }).sort({ createdAt: 1 });
  const [withStats] = await withTotals([sow]);
  res.json({ sow: withStats, boxes, pallets });
});

sowsRouter.post('/', requireRole('admin', 'worker', 'po'), async (req: Request, res: Response) => {
  const { poNumber, batchNo, clientCode, packingType, selectedSKUs, targetItems } = req.body || {};
  if (!poNumber || !batchNo || !clientCode || !packingType) {
    return res.status(400).json({ message: 'PO, Batch, Client, and packing type are required' });
  }
  const type = Number(packingType);
  if (![1, 2, 3].includes(type)) {
    return res.status(400).json({ message: 'Invalid packing type' });
  }
  const skus = Array.isArray(selectedSKUs) ? (selectedSKUs.filter(Boolean) as string[]) : [];
  if (type === 1 || type === 2) {
    if (skus.length !== 1) {
      return res.status(400).json({ message: 'Packing types 1 and 2 require exactly 1 SKU' });
    }
  } else if (skus.length < 2) {
    return res.status(400).json({ message: 'Multi-SKU packing requires at least 2 SKUs' });
  }

  const trimmedPo = String(poNumber).trim();
  const po = await PurchaseOrder.findOne({ poNumber: trimmedPo });
  if (!po) {
    return res.status(400).json({ message: `Purchase order ${trimmedPo} not found` });
  }

  const remaining = await remainingBySkuForPo(trimmedPo, po.items || []);
  const poBySku = new Map((po.items || []).map((i) => [i.sku, i]));

  const rawTargets: Array<{ sku?: string; targetQty?: number }> = Array.isArray(targetItems)
    ? targetItems
    : skus.map((sku) => ({ sku, targetQty: remaining.get(sku) || 0 }));

  const resolvedTargets: Array<{ sku: string; productName: string; targetQty: number }> = [];
  for (const row of rawTargets) {
    const sku = String(row.sku || '').trim();
    if (!sku || !skus.includes(sku)) continue;
    const poLine = poBySku.get(sku);
    if (!poLine) {
      return res.status(400).json({ message: `SKU ${sku} is not on PO ${trimmedPo}` });
    }
    const rem = remaining.get(sku) ?? 0;
    if (rem <= 0) {
      return res.status(400).json({
        message: `No remaining quantity for ${sku} on PO ${trimmedPo}`,
      });
    }
    const qty = Math.floor(Number(row.targetQty));
    if (!Number.isFinite(qty) || qty < 1) {
      return res.status(400).json({ message: `Target qty for ${sku} must be at least 1` });
    }
    if (qty > rem) {
      return res.status(400).json({
        message: `Target qty for ${sku} (${qty}) exceeds remaining (${rem})`,
      });
    }
    resolvedTargets.push({
      sku,
      productName: poLine.productName,
      targetQty: qty,
    });
  }

  if (resolvedTargets.length !== skus.length) {
    return res.status(400).json({
      message: 'Provide a target quantity for every selected SKU',
    });
  }

  if (remaining.size && [...remaining.values()].every((n) => n <= 0)) {
    return res.status(400).json({ message: `PO ${trimmedPo} is fully fulfilled` });
  }

  let sowNumber: string;
  try {
    sowNumber = await nextSowNumber(trimmedPo);
  } catch (err) {
    const e = err as Error & { status?: number };
    return res.status(e.status || 400).json({ message: e.message || 'Invalid PO number' });
  }

  const sow = await Sow.create({
    poNumber: trimmedPo,
    sowNumber,
    batchNo: String(batchNo).trim(),
    clientCode: String(clientCode).trim(),
    packingType: type,
    selectedSKUs: skus,
    targetItems: resolvedTargets,
    status: 'packing',
    createdBy: req.user!._id,
  });

  await PoClient.findOneAndUpdate(
    { poNumber: sow.poNumber },
    { poNumber: sow.poNumber, clientCode: sow.clientCode },
    { upsert: true }
  );

  await writeAudit(req.user!._id, 'SOW_CREATE', {
    sowId: sow._id,
    sowNumber: sow.sowNumber,
    poNumber: sow.poNumber,
    packingType: type,
    selectedSKUs: skus,
    targetItems: resolvedTargets,
    status: sow.status,
  });

  res.status(201).json({ sow });
});

sowsRouter.post('/:id/save', requireRole('admin', 'worker'), async (req: Request, res: Response) => {
  const sow = await Sow.findById(req.params.id);
  if (!sow) return res.status(404).json({ message: 'SOW not found' });
  if (sow.status === 'completed') {
    return res.status(400).json({ message: 'This SOW is already completed' });
  }

  const boxes = await Box.find({ sowId: sow._id });
  const pallets = await Pallet.find({ sowId: sow._id });
  const totalAmount = boxes.reduce((n, b) => n + b.products.length, 0);

  if (sow.status === 'draft') {
    sow.status = 'packing';
    await sow.save();
  }

  await writeAudit(req.user!._id, 'PACKING_SAVE', {
    sowId: sow._id,
    sowNumber: sow.sowNumber,
    poNumber: sow.poNumber,
    batchNo: sow.batchNo,
    clientCode: sow.clientCode,
    packingType: sow.packingType,
    boxIds: boxes.map((b) => b.boxId),
    palletIds: pallets.map((p) => p.palletId),
    totalAmount,
    boxes: boxes.map((b) => ({
      boxId: b.boxId,
      palletId: b.palletId,
      productCount: b.products.length,
      products: b.products,
    })),
  });

  res.json({ sow, totalAmount, boxCount: boxes.length, palletCount: pallets.length });
});

sowsRouter.post('/:id/complete', requireRole('admin', 'worker'), async (req: Request, res: Response) => {
  const sow = await Sow.findById(req.params.id);
  if (!sow) return res.status(404).json({ message: 'SOW not found' });
  if (sow.status === 'completed') {
    return res.status(400).json({ message: 'This SOW is already completed' });
  }

  const missing: string[] = [];
  if (!sow.sowNumber) missing.push('SOW');
  if (!sow.poNumber) missing.push('PO');
  if (!sow.clientCode) missing.push('ClientID');
  if (!sow.batchNo) missing.push('Batch');

  const boxes = await Box.find({ sowId: sow._id });
  if (!boxes.length) {
    missing.push('BoxID');
  }

  const pallets = await Pallet.find({ sowId: sow._id });
  if ((sow.packingType === 2 || sow.packingType === 3) && !pallets.length) {
    missing.push('PalletID');
  }

  if (missing.length) {
    return res.status(400).json({
      message: `${missing.join(', ')} cannot be empty`,
      missing,
    });
  }

  const unlinked = boxes.filter((b) => !b.palletId);
  if ((sow.packingType === 2 || sow.packingType === 3) && unlinked.length) {
    return res.status(409).json({
      code: 'UNLINKED_BOXES',
      message: 'One or more boxes are not linked to a pallet',
      unlinkedBoxes: unlinked.map((b) => b.boxId),
    });
  }

  const po = await PurchaseOrder.findOne({ poNumber: sow.poNumber });
  const targets = resolveTargetItems(sow, po?.items || []);
  if (targets.length) {
    const sowScanned = await scannedBySkuForSow(sow._id);
    const unmet = targets.filter((t) => (sowScanned.bySku.get(t.sku) || 0) < t.targetQty);
    if (unmet.length) {
      const detail = unmet
        .map((t) => `${t.sku} ${sowScanned.bySku.get(t.sku) || 0}/${t.targetQty}`)
        .join(', ');
      return res.status(400).json({
        code: 'SOW_TARGETS_UNMET',
        message: `SOW targets not met yet: ${detail}`,
        unmet: unmet.map((t) => ({
          sku: t.sku,
          targetQty: t.targetQty,
          scannedQty: sowScanned.bySku.get(t.sku) || 0,
        })),
      });
    }
  }

  sow.status = 'completed';
  sow.completedAt = new Date();
  sow.completedBy = req.user!._id;
  await sow.save();

  const totalAmount = boxes.reduce((n, b) => n + b.products.length, 0);
  const poStatus = await syncPoStatus(sow.poNumber);

  await writeAudit(req.user!._id, 'PACKING_COMPLETE', {
    sowId: sow._id,
    sowNumber: sow.sowNumber,
    poNumber: sow.poNumber,
    batchNo: sow.batchNo,
    clientCode: sow.clientCode,
    packingType: sow.packingType,
    boxIds: boxes.map((b) => b.boxId),
    palletIds: pallets.map((p) => p.palletId),
    totalAmount,
    poStatus,
  });

  res.json({ sow, totalAmount, poStatus });
});

sowsRouter.post('/:id/uncomplete', requireRole('admin'), async (req: Request, res: Response) => {
  const sow = await Sow.findById(req.params.id);
  if (!sow) return res.status(404).json({ message: 'SOW not found' });
  if (sow.status !== 'completed') {
    return res.status(400).json({ message: 'Only completed SOWs can be reopened' });
  }

  const updated = await Sow.findByIdAndUpdate(
    sow._id,
    { $set: { status: 'packing' }, $unset: { completedAt: '', completedBy: '' } },
    { new: true }
  );
  if (!updated) return res.status(404).json({ message: 'SOW not found' });

  const poStatus = await syncPoStatus(updated.poNumber);

  await writeAudit(req.user!._id, 'PACKING_UNCOMPLETE', {
    sowId: updated._id,
    sowNumber: updated.sowNumber,
    poNumber: updated.poNumber,
    poStatus,
  });

  res.json({ sow: updated, poStatus });
});

sowsRouter.patch('/:id/sow-number', requireRole('admin'), async (req: Request, res: Response) => {
  const sow = await Sow.findById(req.params.id);
  if (!sow) return res.status(404).json({ message: 'SOW not found' });
  if (sow.status === 'completed') {
    return res.status(400).json({ message: 'Reopen this SOW (Unfinish) before editing' });
  }

  const sowNumber = String(req.body?.sowNumber || '').trim();
  if (!sowNumber) {
    return res.status(400).json({ message: 'sowNumber is required' });
  }

  const duplicate = await Sow.findOne({
    _id: { $ne: sow._id },
    poNumber: sow.poNumber,
    sowNumber,
  });
  if (duplicate) {
    return res.status(409).json({ message: `SOW number ${sowNumber} already exists for this PO` });
  }

  const previous = sow.sowNumber;
  sow.sowNumber = sowNumber;
  await sow.save();

  await writeAudit(req.user!._id, 'SOW_RENAME', {
    sowId: sow._id,
    previous,
    sowNumber,
  });

  res.json({ sow });
});
