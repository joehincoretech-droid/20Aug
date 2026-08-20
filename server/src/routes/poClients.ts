import { Router, type Request, type Response } from 'express';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { PoClient } from '../models/PoClient.js';
import { Sow } from '../models/Sow.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';

export const poClientsRouter = Router();

poClientsRouter.use(authRequired);

poClientsRouter.get('/lookup/:poNumber', async (req: Request, res: Response) => {
  const poNumber = String(req.params.poNumber || '').trim();
  if (!poNumber) {
    return res.status(400).json({ message: 'PO number is required' });
  }

  const order = await PurchaseOrder.findOne({ poNumber });
  if (order) {
    return res.json({
      poNumber: order.poNumber,
      clientCode: order.clientCode,
      items: order.items,
      productOrder: order.items.map((i) => `${i.productName}*${i.qty}`).join('，'),
      selectedSKUs: [...new Set(order.items.map((i) => i.sku))],
      source: 'purchase_order',
    });
  }

  const mapped = await PoClient.findOne({ poNumber });
  if (mapped) {
    return res.json({
      poNumber: mapped.poNumber,
      clientCode: mapped.clientCode,
      items: [],
      productOrder: '',
      selectedSKUs: [],
      source: 'mapping',
    });
  }

  const sow = await Sow.findOne({ poNumber }).sort({ createdAt: -1 });
  if (sow) {
    return res.json({
      poNumber: sow.poNumber,
      clientCode: sow.clientCode,
      items: [],
      productOrder: '',
      selectedSKUs: sow.selectedSKUs || [],
      source: 'sow',
    });
  }

  res.status(404).json({ message: 'No client linked to this PO' });
});

poClientsRouter.get('/', requireRole('admin'), async (_req: Request, res: Response) => {
  const mappings = await PoClient.find().sort({ poNumber: 1 });
  res.json({ mappings });
});

poClientsRouter.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  const { poNumber, clientCode } = req.body || {};
  const nextPo = String(poNumber || '').trim();
  const nextClient = String(clientCode || '').trim();
  if (!nextPo || !nextClient) {
    return res.status(400).json({ message: 'PO number and client code are required' });
  }
  const mapping = await PoClient.findOneAndUpdate(
    { poNumber: nextPo },
    { poNumber: nextPo, clientCode: nextClient },
    { upsert: true, new: true }
  );
  await writeAudit(req.user!._id, 'PO_CLIENT_UPSERT', {
    poNumber: mapping!.poNumber,
    clientCode: mapping!.clientCode,
  });
  res.status(201).json({ mapping });
});
