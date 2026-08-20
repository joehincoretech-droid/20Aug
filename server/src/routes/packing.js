import { Router } from 'express';
import { Sow } from '../models/Sow.js';
import { Box, BOX_PRODUCT_LIMIT } from '../models/Box.js';
import { Pallet, PALLET_BOX_LIMIT } from '../models/Pallet.js';
import { Product } from '../models/Product.js';
import { ProductNameOption } from '../models/ProductNameOption.js';
import { writeAudit } from '../utils/audit.js';
import { authRequired, requireRole } from '../middleware/auth.js';

export const packingRouter = Router();

packingRouter.use(authRequired, requireRole('admin', 'worker'));

async function getActiveSow(sowId) {
  const sow = await Sow.findById(sowId);
  if (!sow) return { error: { status: 404, message: 'SOW not found' } };
  if (sow.status === 'completed') {
    return { error: { status: 400, message: 'This SOW is already completed' } };
  }
  return { sow };
}

packingRouter.post('/boxes', async (req, res) => {
  const { sowId, boxId } = req.body || {};
  if (!sowId || !boxId) {
    return res.status(400).json({ message: 'sowId and boxId are required' });
  }
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });

  const existing = await Box.findOne({ boxId: String(boxId).trim() });
  if (existing) {
    if (String(existing.sowId) !== String(sow._id)) {
      return res.status(409).json({ message: `Box ${existing.boxId} already belongs to another SOW` });
    }
    return res.json({ box: existing, reused: true });
  }

  const box = await Box.create({
    boxId: String(boxId).trim(),
    sowId: sow._id,
    palletId: null,
    products: [],
    completed: false,
  });
  await writeAudit(req.user._id, 'BOX_CREATE', { sowId: sow._id, boxId: box.boxId });
  res.status(201).json({ box, reused: false });
});

packingRouter.post('/pallets', async (req, res) => {
  const { sowId, palletId } = req.body || {};
  if (!sowId || !palletId) {
    return res.status(400).json({ message: 'sowId and palletId are required' });
  }
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  if (sow.packingType === 1) {
    return res.status(400).json({ message: 'Box Only packing does not use pallets' });
  }

  const existing = await Pallet.findOne({ palletId: String(palletId).trim() });
  if (existing) {
    if (String(existing.sowId) !== String(sow._id)) {
      return res.status(409).json({ message: `Pallet ${existing.palletId} already belongs to another SOW` });
    }
    return res.json({ pallet: existing, reused: true });
  }

  const pallet = await Pallet.create({
    palletId: String(palletId).trim(),
    sowId: sow._id,
    boxes: [],
  });
  await writeAudit(req.user._id, 'PALLET_CREATE', { sowId: sow._id, palletId: pallet.palletId });
  res.status(201).json({ pallet, reused: false });
});

packingRouter.post('/link', async (req, res) => {
  const { sowId, boxId, palletId } = req.body || {};
  if (!sowId || !boxId || !palletId) {
    return res.status(400).json({ message: 'sowId, boxId, and palletId are required' });
  }
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  if (sow.packingType === 1) {
    return res.status(400).json({ message: 'Box Only packing does not use pallets' });
  }

  const box = await Box.findOne({ boxId: String(boxId).trim(), sowId: sow._id });
  const pallet = await Pallet.findOne({ palletId: String(palletId).trim(), sowId: sow._id });
  if (!box) return res.status(404).json({ message: 'Box not found on this SOW' });
  if (!pallet) return res.status(404).json({ message: 'Pallet not found on this SOW' });

  if (sow.packingType === 2) {
    const boxSkus = [...new Set(box.products.map((p) => p.sku))];
    if (boxSkus.length > 1) {
      return res.status(400).json({ message: 'Type 2 pallets can only contain a single SKU' });
    }
    const siblingBoxes = await Box.find({ sowId: sow._id, palletId: pallet.palletId });
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

  await writeAudit(req.user._id, 'BOX_LINK_PALLET', {
    sowId: sow._id,
    boxId: box.boxId,
    palletId: pallet.palletId,
  });

  res.json({ box, pallet: updated });
});

packingRouter.post('/unlink', async (req, res) => {
  const { sowId, boxId } = req.body || {};
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  const box = await Box.findOne({ boxId: String(boxId).trim(), sowId: sow._id });
  if (!box) return res.status(404).json({ message: 'Box not found' });
  if (box.palletId) {
    await Pallet.updateOne({ palletId: box.palletId }, { $pull: { boxes: box.boxId } });
  }
  box.palletId = null;
  await box.save();
  await writeAudit(req.user._id, 'BOX_UNLINK_PALLET', { sowId: sow._id, boxId: box.boxId });
  res.json({ box });
});

packingRouter.post('/scan', async (req, res) => {
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

  const box = await Box.findOne({ boxId: String(boxId).trim(), sowId: sow._id });
  if (!box) return res.status(404).json({ message: 'Create or scan a Box ID first' });
  if (box.completed) {
    return res.status(400).json({ message: 'This box is completed. Start a new box.' });
  }
  if (box.products.length >= BOX_PRODUCT_LIMIT) {
    return res.status(400).json({
      message: `Box ${box.boxId} is full (${BOX_PRODUCT_LIMIT}/30 products). Complete the box to continue.`,
    });
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

  if (!sow.selectedSKUs.includes(nextSku)) {
    return res.status(400).json({
      message: `SKU ${nextSku} is not selected for this SOW`,
    });
  }

  if (sow.packingType === 2 && sow.selectedSKUs[0] && nextSku !== sow.selectedSKUs[0]) {
    return res.status(400).json({ message: 'This pallet type allows only one SKU' });
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
  });
  await box.save();

  await writeAudit(req.user._id, 'PRODUCT_SCAN', {
    sowId: sow._id,
    boxId: box.boxId,
    productId: pid,
    sku: catalog.sku,
  });

  res.status(201).json({ box, product: catalog });
});

packingRouter.post('/boxes/:boxId/complete', async (req, res) => {
  const { sowId } = req.body || {};
  const { sow, error } = await getActiveSow(sowId);
  if (error) return res.status(error.status).json({ message: error.message });
  const box = await Box.findOne({ boxId: req.params.boxId, sowId: sow._id });
  if (!box) return res.status(404).json({ message: 'Box not found' });
  box.completed = true;
  await box.save();
  await writeAudit(req.user._id, 'BOX_COMPLETE', {
    sowId: sow._id,
    boxId: box.boxId,
    productCount: box.products.length,
  });
  res.json({ box });
});
