import { Router, type Request, type Response } from 'express';
import { PurchaseOrder, type IPoItem } from '../models/PurchaseOrder.js';
import { PoClient } from '../models/PoClient.js';
import { ProductNameOption } from '../models/ProductNameOption.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { buildPoProgress } from '../utils/poProgress.js';

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.use(authRequired);

function orderLabel(items: IPoItem[] = []): string {
  return items.map((i) => `${i.productName}*${i.qty}`).join('，');
}

async function nextPoNumber(): Promise<string> {
  const docs = await PurchaseOrder.find({ poNumber: /^PO-\d+$/ }, { poNumber: 1 }).lean();
  const max = docs.reduce((n, d) => {
    const value = Number(String(d.poNumber).replace('PO-', ''));
    return Number.isFinite(value) ? Math.max(n, value) : n;
  }, 1000);
  return `PO-${max + 1}`;
}

purchaseOrdersRouter.get('/', requireRole('admin', 'po'), async (_req: Request, res: Response) => {
  const orders = await PurchaseOrder.find()
    .sort({ createdAt: -1 })
    .populate('createdBy', 'username role');

  const withProgress = await Promise.all(
    orders.map(async (o) => {
      const progress = await buildPoProgress(o.poNumber, o.items || []);
      return {
        ...o.toObject(),
        productOrder: orderLabel(o.items),
        orderedQty: progress.orderedQty,
        scannedQty: progress.scannedQty,
        sowCount: progress.sowCount,
        progressItems: progress.items,
      };
    })
  );

  res.json({ orders: withProgress });
});

purchaseOrdersRouter.get('/next-number', requireRole('admin', 'po'), async (_req: Request, res: Response) => {
  res.json({ poNumber: await nextPoNumber() });
});

purchaseOrdersRouter.get('/:poNumber', async (req: Request, res: Response) => {
  const po = await PurchaseOrder.findOne({ poNumber: req.params.poNumber });
  if (!po) return res.status(404).json({ message: 'PO not found' });
  const progress = await buildPoProgress(po.poNumber, po.items || []);
  res.json({
    order: {
      ...po.toObject(),
      productOrder: orderLabel(po.items),
      orderedQty: progress.orderedQty,
      scannedQty: progress.scannedQty,
      sowCount: progress.sowCount,
      sowNumbers: progress.sowNumbers,
      progressItems: progress.items,
    },
  });
});

purchaseOrdersRouter.post('/', requireRole('admin', 'po'), async (req: Request, res: Response) => {
  const { clientCode, items } = req.body || {};
  const nextClient = String(clientCode || '').trim();
  if (!nextClient) {
    return res.status(400).json({ message: 'Client ID is required' });
  }
  const rawItems: Array<{ sku?: string; productName?: string; qty?: number }> = Array.isArray(items)
    ? items
    : [];
  const cleaned = rawItems
    .map((row) => ({
      sku: String(row.sku || '').trim(),
      productName: String(row.productName || '').trim(),
      qty: Number(row.qty),
    }))
    .filter((row) => row.sku && row.qty > 0);

  if (!cleaned.length) {
    return res.status(400).json({ message: 'Add at least one product with quantity' });
  }

  const catalog = await ProductNameOption.find({ sku: { $in: cleaned.map((r) => r.sku) } });
  const bySku = new Map(catalog.map((c) => [c.sku, c.name]));
  const resolved = cleaned.map((row) => ({
    sku: row.sku,
    productName: bySku.get(row.sku) || row.productName,
    qty: Math.floor(row.qty),
  }));

  if (resolved.some((r) => !r.productName)) {
    return res.status(400).json({ message: 'Every line must use a valid SKU / product name' });
  }

  const poNumber = await nextPoNumber();
  const order = await PurchaseOrder.create({
    poNumber,
    clientCode: nextClient,
    items: resolved,
    createdBy: req.user!._id,
  });

  await PoClient.findOneAndUpdate(
    { poNumber },
    { poNumber, clientCode: nextClient },
    { upsert: true }
  );

  await writeAudit(req.user!._id, 'PO_CREATE', {
    poNumber,
    clientCode: nextClient,
    productOrder: orderLabel(resolved),
    items: resolved,
  });

  res.status(201).json({
    order: { ...order.toObject(), productOrder: orderLabel(resolved) },
  });
});
