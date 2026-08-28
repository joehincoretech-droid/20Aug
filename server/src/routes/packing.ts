import { Router, type Request, type Response } from 'express';
import { Sow, type SowDocument } from '../models/Sow.js';
import { Box } from '../models/Box.js';
import { Pallet, PALLET_BOX_LIMIT } from '../models/Pallet.js';
import { Product } from '../models/Product.js';
import { ProductNameOption } from '../models/ProductNameOption.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import { assertCanScan, getPurchaseOrderByNumber, syncPoStatus } from '../utils/poProgress.js';

export const packingRouter = Router();

packingRouter.use(authRequired, requireRole('admin', 'worker'));

type ActiveSowResult =
  | { sow: SowDocument; error?: undefined }
  | { sow?: undefined; error: { status: number; message: string } };

async function getActiveSow(sowId: string): Promise<ActiveSowResult> {
  const sow = await Sow.findById(sowId);
  if (!sow) return { error: { status: 404, message: 'SOW not found' } };
  if (sow.status === 'completed') {
    return { error: { status: 400, message: 'This SOW is already completed' } };
  }
  return { sow };
}

packingRouter.post('/boxes', async (req: Request, res: Response) => {
  const { sowId, boxId } = req.body || {};
  if (!sowId || !boxId) {
    return res.status(400).json({ message: 'sowId and boxId are required' });
  }
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });

  const existing = await Box.findOne({ boxId: String(boxId).trim() });
  if (existing) {
    if (String(existing.sowId) !== String(sow!._id)) {
      return res.status(409).json({ message: `Box ${existing.boxId} already belongs to another SOW` });
    }
    return res.json({ box: existing, reused: true });
  }

  const box = await Box.create({
    boxId: String(boxId).trim(),
    sowId: sow!._id,
    palletId: null,
    products: [],
    completed: false,
  });
  await writeAudit(req.user!._id, 'BOX_CREATE', { sowId: sow!._id, boxId: box.boxId });
  res.status(201).json({ box, reused: false });
});

packingRouter.post('/pallets', async (req: Request, res: Response) => {
  const { sowId, palletId } = req.body || {};
  if (!sowId || !palletId) {
    return res.status(400).json({ message: 'sowId and palletId are required' });
  }
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  if (sow!.packingType === 1) {
    return res.status(400).json({ message: 'Box Only packing does not use pallets' });
  }

  const existing = await Pallet.findOne({ palletId: String(palletId).trim() });
  if (existing) {
    if (String(existing.sowId) !== String(sow!._id)) {
      return res.status(409).json({ message: `Pallet ${existing.palletId} already belongs to another SOW` });
    }
    return res.json({ pallet: existing, reused: true });
  }

  const pallet = await Pallet.create({
    palletId: String(palletId).trim(),
    sowId: sow!._id,
    boxes: [],
  });
  await writeAudit(req.user!._id, 'PALLET_CREATE', { sowId: sow!._id, palletId: pallet.palletId });
  res.status(201).json({ pallet, reused: false });
});

packingRouter.post('/link', async (req: Request, res: Response) => {
  const { sowId, boxId, palletId } = req.body || {};
  if (!sowId || !boxId || !palletId) {
    return res.status(400).json({ message: 'sowId, boxId, and palletId are required' });
  }
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  if (sow!.packingType === 1) {
    return res.status(400).json({ message: 'Box Only packing does not use pallets' });
  }

  const box = await Box.findOne({ boxId: String(boxId).trim(), sowId: sow!._id });
  const pallet = await Pallet.findOne({ palletId: String(palletId).trim(), sowId: sow!._id });
  if (!box) return res.status(404).json({ message: 'Box not found on this SOW' });
  if (!pallet) return res.status(404).json({ message: 'Pallet not found on this SOW' });

  if (sow!.packingType === 2) {
    const boxSkus = [...new Set(box.products.map((p) => p.sku))];
    if (boxSkus.length > 1) {
      return res.status(400).json({ message: 'Type 2 pallets can only contain a single SKU' });
    }
    const siblingBoxes = await Box.find({ sowId: sow!._id, palletId: pallet.palletId });
    const palletSkus = new Set(siblingBoxes.flatMap((b) => b.products.map((p) => p.sku)));
    for (const sku of boxSkus) palletSkus.add(sku);
    if (palletSkus.size > 1) {
      return res.status(400).json({
        message: 'Only one SKU is allowed on this pallet (packing type 2)',
      });
    }
  }

  if (box.palletId && box.palletId !== pallet.palletId) {
    await Pallet.updateOne({ palletId: box.palletId }, { $pull: { boxes: box.boxId } });
  }

  if (!pallet.boxes.includes(box.boxId) && pallet.boxes.length >= PALLET_BOX_LIMIT) {
    return res.status(400).json({
      message: `Pallet ${pallet.palletId} is full (${PALLET_BOX_LIMIT}/50 boxes)`,
    });
  }

  box.palletId = pallet.palletId;
  await box.save();
  await Pallet.updateOne(
    { _id: pallet._id },
    { $addToSet: { boxes: box.boxId } }
  );
  const updated = await Pallet.findById(pallet._id);

  await writeAudit(req.user!._id, 'BOX_LINK_PALLET', {
    sowId: sow!._id,
    boxId: box.boxId,
    palletId: pallet.palletId,
  });

  res.json({ box, pallet: updated });
});

packingRouter.post('/unlink', async (req: Request, res: Response) => {
  const { sowId, boxId } = req.body || {};
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  const box = await Box.findOne({ boxId: String(boxId).trim(), sowId: sow!._id });
  if (!box) return res.status(404).json({ message: 'Box not found' });
  if (box.palletId) {
    await Pallet.updateOne({ palletId: box.palletId }, { $pull: { boxes: box.boxId } });
  }
  box.palletId = null;
  await box.save();
  await writeAudit(req.user!._id, 'BOX_UNLINK_PALLET', { sowId: sow!._id, boxId: box.boxId });
  res.json({ box });
});

packingRouter.post('/scan', async (req: Request, res: Response) => {
  const { sowId, boxId, productId, sku, productName } = req.body || {};
  if (!sowId || !boxId || !productId) {
    return res.status(400).json({ message: 'sowId, boxId, and productId are required' });
  }
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });

  const pid = String(productId).trim();
  const duplicate = await Box.findOne({ 'products.productId': pid });
  if (duplicate) {
    return res.status(409).json({
      code: 'DUPLICATE_PRODUCT',
      message: `${pid} have been store in ${duplicate.boxId}`,
      productId: pid,
      boxId: duplicate.boxId,
    });
  }

  const box = await Box.findOne({ boxId: String(boxId).trim(), sowId: sow!._id });
  if (!box) return res.status(404).json({ message: 'Create or scan a Box ID first' });
  if (box.completed) {
    return res.status(400).json({ message: 'This box is completed. Start a new box.' });
  }

  let catalog = await Product.findOne({ productId: pid });
  let nextSku = sku || catalog?.sku;
  let nextName = productName || catalog?.productName;

  if (nextSku && !nextName) {
    const linked = await ProductNameOption.findOne({ sku: nextSku });
    if (linked) nextName = linked.name;
  }

  if (!nextSku || !nextName) {
    return res.status(400).json({
      code: 'SKU_REQUIRED',
      message: 'Unknown product. Select a SKU (product name is linked automatically).',
    });
  }

  if (!sow!.selectedSKUs.includes(nextSku)) {
    return res.status(400).json({
      message: `SKU ${nextSku} is not selected for this SOW`,
    });
  }

  const skuOption = await ProductNameOption.findOne({ sku: nextSku });
  const boxesPerOuterBox = skuOption?.boxesPerOuterBox;
  if (!boxesPerOuterBox || boxesPerOuterBox < 1) {
    return res.status(400).json({
      code: 'BOX_CAPACITY_NOT_SET',
      message: `SKU ${nextSku} has no boxes/outer box configured. Ask admin or PO clerk to set it.`,
      sku: nextSku,
    });
  }

  if (box.products.length >= boxesPerOuterBox) {
    return res.status(400).json({
      message: `Box ${box.boxId} is full (${box.products.length}/${boxesPerOuterBox} boxes). Complete the box to continue.`,
      boxesPerOuterBox,
    });
  }

  // One box = one SKU (all packing types)
  if (box.products.length > 0) {
    const existingSku = box.products[0].sku;
    if (existingSku && existingSku !== nextSku) {
      return res.status(400).json({
        code: 'MIXED_SKU_BOX',
        message: `Box ${box.boxId} already contains ${existingSku}. One box = one SKU.`,
        boxId: box.boxId,
        existingSku,
        sku: nextSku,
      });
    }
  }

  if (sow!.packingType === 2 && sow!.selectedSKUs[0] && nextSku !== sow!.selectedSKUs[0]) {
    return res.status(400).json({ message: 'This pallet type allows only one SKU' });
  }

  const po = await getPurchaseOrderByNumber(sow!.poNumber);
  const qtyError = await assertCanScan(sow!, nextSku, po?.items || []);
  if (qtyError) {
    return res.status(qtyError.status).json({
      code: qtyError.code,
      message: qtyError.message,
      sku: qtyError.sku,
      ordered: qtyError.ordered,
      target: qtyError.target,
      scanned: qtyError.scanned,
    });
  }

  if (!catalog) {
    catalog = await Product.create({
      productId: pid,
      productName: nextName,
      sku: nextSku,
    });
  }

  box.products.push({
    productId: pid,
    productName: catalog.productName,
    sku: catalog.sku,
    packedAt: new Date(),
  });
  await box.save();

  await writeAudit(req.user!._id, 'PRODUCT_SCAN', {
    sowId: sow!._id,
    boxId: box.boxId,
    productId: pid,
    sku: catalog.sku,
  });

  await syncPoStatus(sow!.poNumber);

  res.status(201).json({ box, product: catalog, boxesPerOuterBox });
});

packingRouter.post('/boxes/:boxId/complete', async (req: Request, res: Response) => {
  const { sowId } = req.body || {};
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  const box = await Box.findOne({ boxId: req.params.boxId, sowId: sow!._id });
  if (!box) return res.status(404).json({ message: 'Box not found' });
  box.completed = true;
  await box.save();
  await writeAudit(req.user!._id, 'BOX_COMPLETE', {
    sowId: sow!._id,
    boxId: box.boxId,
    productCount: box.products.length,
  });
  res.json({ box });
});

packingRouter.patch('/boxes/rename', requireRole('admin'), async (req: Request, res: Response) => {
  const { sowId, oldBoxId, newBoxId } = req.body || {};
  if (!sowId || !oldBoxId || !newBoxId) {
    return res.status(400).json({ message: 'sowId, oldBoxId, and newBoxId are required' });
  }

  const sow = await Sow.findById(sowId);
  if (!sow) return res.status(404).json({ message: 'SOW not found' });
  if (sow.status === 'completed') {
    return res.status(400).json({ message: 'Reopen this SOW (Unfinish) before editing' });
  }

  const trimmedOld = String(oldBoxId).trim();
  const trimmedNew = String(newBoxId).trim();
  if (!trimmedNew) {
    return res.status(400).json({ message: 'newBoxId is required' });
  }
  if (trimmedOld === trimmedNew) {
    return res.status(400).json({ message: 'New Outer Box ID must differ from the current ID' });
  }

  const box = await Box.findOne({ boxId: trimmedOld, sowId: sow._id });
  if (!box) return res.status(404).json({ message: 'Outer box not found on this SOW' });

  const existing = await Box.findOne({ boxId: trimmedNew });
  if (existing) {
    return res.status(409).json({ message: `Outer Box ID ${trimmedNew} is already in use` });
  }

  box.boxId = trimmedNew;
  await box.save();

  const pallets = await Pallet.find({ sowId: sow._id, boxes: trimmedOld });
  await Promise.all(
    pallets.map(async (pallet) => {
      pallet.boxes = pallet.boxes.map((id) => (id === trimmedOld ? trimmedNew : id));
      await pallet.save();
    })
  );

  await writeAudit(req.user!._id, 'BOX_RENAME', {
    sowId: sow._id,
    previous: trimmedOld,
    boxId: trimmedNew,
  });

  res.json({ box });
});

packingRouter.patch('/pallets/rename', requireRole('admin'), async (req: Request, res: Response) => {
  const { sowId, oldPalletId, newPalletId } = req.body || {};
  if (!sowId || !oldPalletId || !newPalletId) {
    return res.status(400).json({ message: 'sowId, oldPalletId, and newPalletId are required' });
  }

  const sow = await Sow.findById(sowId);
  if (!sow) return res.status(404).json({ message: 'SOW not found' });
  if (sow.status === 'completed') {
    return res.status(400).json({ message: 'Reopen this SOW (Unfinish) before editing' });
  }
  if (sow.packingType === 1) {
    return res.status(400).json({ message: 'Box Only packing does not use pallets' });
  }

  const trimmedOld = String(oldPalletId).trim();
  const trimmedNew = String(newPalletId).trim();
  if (!trimmedNew) {
    return res.status(400).json({ message: 'newPalletId is required' });
  }
  if (trimmedOld === trimmedNew) {
    return res.status(400).json({ message: 'New Pallet ID must differ from the current ID' });
  }

  const pallet = await Pallet.findOne({ palletId: trimmedOld, sowId: sow._id });
  if (!pallet) return res.status(404).json({ message: 'Pallet not found on this SOW' });

  const existing = await Pallet.findOne({ palletId: trimmedNew });
  if (existing) {
    return res.status(409).json({ message: `Pallet ID ${trimmedNew} is already in use` });
  }

  pallet.palletId = trimmedNew;
  await pallet.save();

  await Box.updateMany(
    { sowId: sow._id, palletId: trimmedOld },
    { $set: { palletId: trimmedNew } }
  );

  await writeAudit(req.user!._id, 'PALLET_RENAME', {
    sowId: sow._id,
    previous: trimmedOld,
    palletId: trimmedNew,
  });

  res.json({ pallet });
});
