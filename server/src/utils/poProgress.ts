import type { Types } from 'mongoose';
import { Sow, type SowDocument } from '../models/Sow.js';
import { Box } from '../models/Box.js';
import { PurchaseOrder, type IPoItem } from '../models/PurchaseOrder.js';

export interface SkuProgress {
  sku: string;
  productName: string;
  orderedQty: number;
  scannedQty: number;
  remainingQty: number;
}

export interface SowSkuProgress {
  sku: string;
  productName: string;
  orderedQty: number;
  scannedQty: number;
  poRemaining: number;
}

export interface PoLinkedSow {
  _id: string;
  sowNumber: string;
}

export interface PoProgress {
  orderedQty: number;
  scannedQty: number;
  remainingQty: number;
  status: 'open' | 'fulfilled';
  items: SkuProgress[];
  sowCount: number;
  sowNumbers: string[];
  sows: PoLinkedSow[];
}

export type ScanQtyError = {
  status: number;
  code: 'PO_QTY_FULL' | 'SOW_QTY_FULL';
  message: string;
  sku: string;
  ordered?: number;
  target?: number;
  scanned: number;
};

/** Count scanned products by SKU for all SOWs under a PO. */
export async function scannedBySkuForPo(poNumber: string): Promise<{
  bySku: Map<string, number>;
  total: number;
  sowIds: string[];
  sowNumbers: string[];
}> {
  const sows = await Sow.find({ poNumber }).select('_id sowNumber');
  const sowIds = sows.map((s) => s._id);
  const bySku = new Map<string, number>();
  let total = 0;
  if (sowIds.length) {
    const boxes = await Box.find({ sowId: { $in: sowIds } }).select('products');
    for (const box of boxes) {
      for (const p of box.products) {
        total += 1;
        bySku.set(p.sku, (bySku.get(p.sku) || 0) + 1);
      }
    }
  }
  return {
    bySku,
    total,
    sowIds: sowIds.map(String),
    sowNumbers: sows.map((s) => s.sowNumber),
  };
}

/** Count scanned products by SKU for a single SOW. */
export async function scannedBySkuForSow(
  sowId: string | Types.ObjectId
): Promise<{ bySku: Map<string, number>; total: number }> {
  const boxes = await Box.find({ sowId }).select('products');
  const bySku = new Map<string, number>();
  let total = 0;
  for (const box of boxes) {
    for (const p of box.products) {
      total += 1;
      bySku.set(p.sku, (bySku.get(p.sku) || 0) + 1);
    }
  }
  return { bySku, total };
}

/** Sum allocated targetQty by SKU across all SOWs under a PO. */
export async function allocatedBySkuForPo(poNumber: string): Promise<Map<string, number>> {
  const sows = await Sow.find({ poNumber }).select('selectedSKUs targetItems');
  const bySku = new Map<string, number>();
  for (const sow of sows) {
    const targets = resolveTargetItems(sow, []);
    // Prefer stored targetItems only; if empty, fall back to summing nothing here
    // unless we have targetItems. resolveTargetItems with empty poItems returns
    // stored targets, or [] if none (won't inflate with full PO qty).
    for (const t of targets) {
      bySku.set(t.sku, (bySku.get(t.sku) || 0) + t.targetQty);
    }
  }
  return bySku;
}

/**
 * Remaining PO qty per SKU available to allocate to a new SOW
 * = ordered − sum(targetQty of existing SOWs).
 * Falls back to ordered − scanned when a SKU has no allocations yet but has scans.
 */
export async function remainingBySkuForPo(
  poNumber: string,
  items: IPoItem[] = []
): Promise<Map<string, number>> {
  const [allocated, scanned] = await Promise.all([
    allocatedBySkuForPo(poNumber),
    scannedBySkuForPo(poNumber),
  ]);
  const remaining = new Map<string, number>();
  for (const item of items) {
    const ordered = item.qty || 0;
    const used = Math.max(allocated.get(item.sku) || 0, scanned.bySku.get(item.sku) || 0);
    remaining.set(item.sku, Math.max(0, ordered - used));
  }
  return remaining;
}

export function isPoFulfilled(items: SkuProgress[]): boolean {
  if (!items.length) return false;
  return items.every((i) => i.orderedQty > 0 && i.scannedQty >= i.orderedQty);
}

export async function buildPoProgress(
  poNumber: string,
  items: IPoItem[] = []
): Promise<PoProgress> {
  const [scanned, allocated] = await Promise.all([
    scannedBySkuForPo(poNumber),
    allocatedBySkuForPo(poNumber),
  ]);
  const orderedQty = items.reduce((n, i) => n + (i.qty || 0), 0);
  const progressItems: SkuProgress[] = items.map((i) => {
    const scannedQty = scanned.bySku.get(i.sku) || 0;
    const allocatedQty = allocated.get(i.sku) || 0;
    const used = Math.max(allocatedQty, scannedQty);
    return {
      sku: i.sku,
      productName: i.productName,
      orderedQty: i.qty,
      scannedQty,
      remainingQty: Math.max(0, (i.qty || 0) - used),
    };
  });
  // Include scanned SKUs not on the PO (edge case)
  for (const [sku, qty] of scanned.bySku) {
    if (!progressItems.some((i) => i.sku === sku)) {
      progressItems.push({
        sku,
        productName: sku,
        orderedQty: 0,
        scannedQty: qty,
        remainingQty: 0,
      });
    }
  }
  const remainingQty = progressItems.reduce((n, i) => n + i.remainingQty, 0);
  const sows = scanned.sowIds.map((id, i) => ({
    _id: id,
    sowNumber: scanned.sowNumbers[i] || id,
  }));
  return {
    orderedQty,
    scannedQty: scanned.total,
    remainingQty,
    status: isPoFulfilled(progressItems) ? 'fulfilled' : 'open',
    items: progressItems,
    sowCount: sows.length,
    sowNumbers: sows.map((s) => s.sowNumber),
    sows,
  };
}

/** Resolve effective target items (backfill from PO for legacy SOWs). */
export function resolveTargetItems(
  sow: Pick<SowDocument, 'selectedSKUs' | 'targetItems'>,
  poItems: IPoItem[] = []
): Array<{ sku: string; productName: string; targetQty: number }> {
  const stored = (sow.targetItems || []).filter((t) => t.sku && t.targetQty > 0);
  if (stored.length) {
    return stored.map((t) => ({
      sku: t.sku,
      productName: t.productName || t.sku,
      targetQty: t.targetQty,
    }));
  }
  const selected = new Set(sow.selectedSKUs || []);
  return (poItems || [])
    .filter((i) => selected.has(i.sku))
    .map((i) => ({
      sku: i.sku,
      productName: i.productName,
      targetQty: i.qty,
    }));
}

export async function buildSowProgress(
  sow: SowDocument,
  poItems: IPoItem[] = []
): Promise<{
  targetItems: Array<{ sku: string; productName: string; targetQty: number }>;
  progressItems: SowSkuProgress[];
  orderedQty: number;
  scannedQty: number;
}> {
  const targets = resolveTargetItems(sow, poItems);
  const [sowScanned, poScanned] = await Promise.all([
    scannedBySkuForSow(sow._id),
    scannedBySkuForPo(sow.poNumber),
  ]);

  const progressItems: SowSkuProgress[] = targets.map((t) => {
    const poLine = poItems.find((i) => i.sku === t.sku);
    const poOrdered = poLine?.qty || 0;
    const poScannedQty = poScanned.bySku.get(t.sku) || 0;
    return {
      sku: t.sku,
      productName: t.productName,
      orderedQty: t.targetQty,
      scannedQty: sowScanned.bySku.get(t.sku) || 0,
      // Packing view: how many are still unscanned on the PO (not unallocated)
      poRemaining: Math.max(0, poOrdered - poScannedQty),
    };
  });

  return {
    targetItems: targets,
    progressItems,
    orderedQty: targets.reduce((n, t) => n + t.targetQty, 0),
    scannedQty: sowScanned.total,
  };
}

/**
 * Assert a product of `sku` can still be scanned into this SOW.
 * Checks SOW target first, then PO remaining (all SOWs under the PO).
 */
export async function assertCanScan(
  sow: SowDocument,
  sku: string,
  poItems: IPoItem[] = []
): Promise<ScanQtyError | null> {
  const targets = resolveTargetItems(sow, poItems);
  const target = targets.find((t) => t.sku === sku);
  const sowScanned = await scannedBySkuForSow(sow._id);
  const sowCount = sowScanned.bySku.get(sku) || 0;

  if (target) {
    if (sowCount >= target.targetQty) {
      return {
        status: 400,
        code: 'SOW_QTY_FULL',
        message: `SOW target met for ${sku} (${sowCount}/${target.targetQty})`,
        sku,
        target: target.targetQty,
        scanned: sowCount,
      };
    }
  }

  const poLine = poItems.find((i) => i.sku === sku);
  if (poLine) {
    const poScanned = await scannedBySkuForPo(sow.poNumber);
    const poCount = poScanned.bySku.get(sku) || 0;
    if (poCount >= poLine.qty) {
      return {
        status: 400,
        code: 'PO_QTY_FULL',
        message: `PO order met for ${sku} (${poCount}/${poLine.qty})`,
        sku,
        ordered: poLine.qty,
        scanned: poCount,
      };
    }
  }

  return null;
}

export async function syncPoStatus(poNumber: string): Promise<'open' | 'fulfilled'> {
  const po = await PurchaseOrder.findOne({ poNumber: String(poNumber).trim() });
  if (!po) return 'open';
  const progress = await buildPoProgress(po.poNumber, po.items || []);
  if (po.status !== progress.status) {
    po.status = progress.status;
    await po.save();
  }
  return progress.status;
}

export async function getPurchaseOrderByNumber(poNumber: string) {
  return PurchaseOrder.findOne({ poNumber: String(poNumber).trim() });
}
