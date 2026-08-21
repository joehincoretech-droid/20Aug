import { Sow } from '../models/Sow.js';
import { Box } from '../models/Box.js';
import { PurchaseOrder, type IPoItem } from '../models/PurchaseOrder.js';

export interface SkuProgress {
  sku: string;
  productName: string;
  orderedQty: number;
  scannedQty: number;
}

export interface PoProgress {
  orderedQty: number;
  scannedQty: number;
  items: SkuProgress[];
  sowCount: number;
  sowNumbers: string[];
}

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

export async function buildPoProgress(
  poNumber: string,
  items: IPoItem[] = []
): Promise<PoProgress> {
  const scanned = await scannedBySkuForPo(poNumber);
  const orderedQty = items.reduce((n, i) => n + (i.qty || 0), 0);
  const progressItems: SkuProgress[] = items.map((i) => ({
    sku: i.sku,
    productName: i.productName,
    orderedQty: i.qty,
    scannedQty: scanned.bySku.get(i.sku) || 0,
  }));
  // Include scanned SKUs not on the PO (edge case)
  for (const [sku, qty] of scanned.bySku) {
    if (!progressItems.some((i) => i.sku === sku)) {
      progressItems.push({
        sku,
        productName: sku,
        orderedQty: 0,
        scannedQty: qty,
      });
    }
  }
  return {
    orderedQty,
    scannedQty: scanned.total,
    items: progressItems,
    sowCount: scanned.sowNumbers.length,
    sowNumbers: scanned.sowNumbers,
  };
}

export async function getPurchaseOrderByNumber(poNumber: string) {
  return PurchaseOrder.findOne({ poNumber: String(poNumber).trim() });
}
