import { Router, type Request, type Response } from 'express';
import { ProductNameOption } from '../models/ProductNameOption.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { parseBoxesPerOuterBox, validateBoxesPerOuterBox } from '../utils/boxCapacity.js';

export const productNamesRouter = Router();

productNamesRouter.get('/', authRequired, async (_req: Request, res: Response) => {
  const names = await ProductNameOption.find().sort({ sortOrder: 1, sku: 1 });
  res.json({ names });
});

productNamesRouter.use(authRequired, requireRole('admin', 'po'));

productNamesRouter.post('/', async (req: Request, res: Response) => {
  const { sku, name, boxesPerOuterBox } = req.body || {};
  const nextSku = String(sku || '').trim();
  const trimmed = String(name || '').trim();
  if (!nextSku || !trimmed) {
    return res.status(400).json({ message: 'SKU and product name are required' });
  }
  const capacityError = validateBoxesPerOuterBox(boxesPerOuterBox);
  if (capacityError) {
    return res.status(400).json({ message: capacityError });
  }
  const nextCapacity = parseBoxesPerOuterBox(boxesPerOuterBox)!;
  const existsName = await ProductNameOption.findOne({ name: trimmed });
  if (existsName) {
    return res.status(409).json({ message: 'This product name already exists' });
  }
  const existsSku = await ProductNameOption.findOne({ sku: nextSku });
  if (existsSku) {
    return res.status(409).json({ message: 'This SKU already exists' });
  }
  const count = await ProductNameOption.countDocuments();
  const option = await ProductNameOption.create({
    sku: nextSku,
    name: trimmed,
    boxesPerOuterBox: nextCapacity,
    sortOrder: count,
  });
  await writeAudit(req.user!._id, 'PRODUCT_NAME_CREATE', {
    sku: option.sku,
    name: option.name,
    boxesPerOuterBox: option.boxesPerOuterBox,
  });
  res.status(201).json({ name: option });
});

productNamesRouter.patch('/:id', async (req: Request, res: Response) => {
  const { sku, name, boxesPerOuterBox } = req.body || {};
  const nextSku = String(sku || '').trim();
  const trimmed = String(name || '').trim();
  if (!nextSku || !trimmed) {
    return res.status(400).json({ message: 'SKU and product name are required' });
  }
  const capacityError = validateBoxesPerOuterBox(boxesPerOuterBox);
  if (capacityError) {
    return res.status(400).json({ message: capacityError });
  }
  const nextCapacity = parseBoxesPerOuterBox(boxesPerOuterBox)!;
  const option = await ProductNameOption.findById(req.params.id);
  if (!option) {
    return res.status(404).json({ message: 'Product name not found' });
  }
  const duplicateName = await ProductNameOption.findOne({ name: trimmed, _id: { $ne: option._id } });
  if (duplicateName) {
    return res.status(409).json({ message: 'This product name already exists' });
  }
  const duplicateSku = await ProductNameOption.findOne({ sku: nextSku, _id: { $ne: option._id } });
  if (duplicateSku) {
    return res.status(409).json({ message: 'This SKU already exists' });
  }
  const previous = {
    sku: option.sku,
    name: option.name,
    boxesPerOuterBox: option.boxesPerOuterBox,
  };
  option.sku = nextSku;
  option.name = trimmed;
  option.boxesPerOuterBox = nextCapacity;
  await option.save();
  await writeAudit(req.user!._id, 'PRODUCT_NAME_UPDATE', {
    previous,
    sku: option.sku,
    name: option.name,
    boxesPerOuterBox: option.boxesPerOuterBox,
  });
  res.json({ name: option });
});

productNamesRouter.delete('/:id', async (req: Request, res: Response) => {
  const option = await ProductNameOption.findByIdAndDelete(req.params.id);
  if (!option) {
    return res.status(404).json({ message: 'Product name not found' });
  }
  await writeAudit(req.user!._id, 'PRODUCT_NAME_DELETE', { sku: option.sku, name: option.name });
  res.json({ ok: true });
});
