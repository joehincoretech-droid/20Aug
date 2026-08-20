import { Router, type Request, type Response } from 'express';
import type { FilterQuery } from 'mongoose';
import { Sow, type ISow, type SowDocument } from '../models/Sow.js';
import { Box } from '../models/Box.js';
import { Pallet } from '../models/Pallet.js';
import { PoClient } from '../models/PoClient.js';
import { ProductNameOption } from '../models/ProductNameOption.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';

export const sowsRouter = Router();

sowsRouter.use(authRequired);

function packingTypeLabel(type: number): string {
  if (type === 1) return 'Box Only';
  if (type === 2) return '1 SKU / Pallet';
  if (type === 3) return 'Multi-SKU / Pallet';
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
  const prefix = `SOW-${suffix}-`;
  const existing = await Sow.find({
    poNumber: String(poNumber).trim(),
    sowNumber: new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\d{4}$`),
  }).select('sowNumber');

  let max = 0;
  for (const sow of existing) {
    const seq = Number(String(sow.sowNumber).slice(prefix.length));
    if (Number.isFinite(seq)) max = Math.max(max, seq);
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

async function skuNameMap(): Promise<Map<string, string>> {
  const options = await ProductNameOption.find();
  return new Map(options.map((o) => [o.sku, o.name]));
}

async function withTotals(sows: SowDocument[]) {
  const ids = sows.map((s) => s._id);
  const boxes = await Box.find({ sowId: { $in: ids } });
  const namesBySku = await skuNameMap();
  const bySow = new Map<string, { totalAmount: number; boxCount: number }>();
  for (const box of boxes) {
    const key = String(box.sowId);
    const prev = bySow.get(key) || { totalAmount: 0, boxCount: 0 };
    prev.totalAmount += box.products.length;
    prev.boxCount += 1;
    bySow.set(key, prev);
  }
  return sows.map((sow) => {
    const stats = bySow.get(String(sow._id)) || { totalAmount: 0, boxCount: 0 };
    const selectedSKULabels = (sow.selectedSKUs || []).map((sku) => ({
      sku,
      productName: namesBySku.get(sku) || sku,
    }));
    return {
      ...sow.toObject(),
      packingTypeLabel: packingTypeLabel(sow.packingType),
      totalAmount: stats.totalAmount,
      boxCount: stats.boxCount,
      selectedSKULabels,
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

sowsRouter.get('/next-number', requireRole('admin', 'worker'), async (req: Request, res: Response) => {
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

sowsRouter.post('/', requireRole('admin', 'worker'), async (req: Request, res: Response) => {
  const { poNumber, batchNo, clientCode, packingType, selectedSKUs } = req.body || {};
  if (!poNumber || !batchNo || !clientCode || !packingType) {
    return res.status(400).json({ message: 'PO, Batch, Client, and packing type are required' });
  }
  const type = Number(packingType);
  if (![1, 2, 3].includes(type)) {
    return res.status(400).json({ message: 'Invalid packing type' });
  }
  const skus = Array.isArray(selectedSKUs) ? selectedSKUs.filter(Boolean) as string[] : [];
  if (type === 1 || type === 2) {
    if (skus.length !== 1) {
      return res.status(400).json({ message: 'Packing types 1 and 2 require exactly 1 SKU' });
    }
  } else if (skus.length < 2) {
    return res.status(400).json({ message: 'Multi-SKU packing requires at least 2 SKUs' });
  }

  const trimmedPo = String(poNumber).trim();
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

  sow.status = 'completed';
  sow.completedAt = new Date();
  sow.completedBy = req.user!._id;
  await sow.save();

  const totalAmount = boxes.reduce((n, b) => n + b.products.length, 0);
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
  });

  res.json({ sow, totalAmount });
});
