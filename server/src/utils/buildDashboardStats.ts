import type { UserRole } from '../models/User.js';
import { Sow } from '../models/Sow.js';
import { Box } from '../models/Box.js';
import { PurchaseOrder } from '../models/PurchaseOrder.js';
import { ProductNameOption } from '../models/ProductNameOption.js';
import { buildPoProgress, resolveTargetItems } from './poProgress.js';

export interface ChartSlice {
  name: string;
  value: number;
  color: string;
}

export interface TopPoItem {
  poNumber: string;
  scanned: number;
  ordered: number;
  pct: number;
}

export interface TopSkuItem {
  sku: string;
  productName: string;
  scanned: number;
}

export interface DeliveryPoItem {
  poNumber: string;
  clientCode: string;
  estimatedDeliveryDate: string | null;
  fulfillmentPct: number;
  scannedQty: number;
  orderedQty: number;
}

export interface RecentActiveSow {
  _id: string;
  sowNumber: string;
  poNumber: string;
  progressPct: number;
  scannedQty: number;
  orderedQty: number;
}

export interface DashboardKpis {
  openPos: number;
  fulfilledPos: number;
  activeSows: number;
  completedSows: number;
  productsPacked: number;
  boxesPacked: number;
  fulfillmentPct: number | null;
}

export interface DashboardStats {
  role: UserRole;
  kpis: DashboardKpis;
  poStatusSlices: ChartSlice[];
  sowStatusSlices: ChartSlice[];
  progressSlices: ChartSlice[];
  packingTypeSlices: ChartSlice[];
  topPos: TopPoItem[];
  topSkus: TopSkuItem[];
  deliverySoon: DeliveryPoItem[];
  deliveryOverdue: DeliveryPoItem[];
  recentActiveSows: RecentActiveSow[];
  showPo: boolean;
  showSow: boolean;
}

const STATUS_COLORS = {
  open: '#60a5fa',
  fulfilled: '#1e3a8a',
  packing: '#60a5fa',
  completed: '#1e3a8a',
};

const PACKING_TYPE_LABELS: Record<number, string> = {
  1: 'Only box',
  2: '1 pallet · 1 SKU',
  3: '1 pallet · multi SKU',
};

const PACKING_TYPE_COLORS: Record<number, string> = {
  1: '#1e3a8a',
  2: '#2563eb',
  3: '#3b82f6',
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function pct(scanned: number, ordered: number): number {
  if (ordered <= 0) return 0;
  return Math.round((scanned / ordered) * 100);
}

export async function buildDashboardStats(role: UserRole): Promise<DashboardStats> {
  const showPo = role === 'admin' || role === 'po';
  const showSow = role === 'admin' || role === 'worker';

  const empty: DashboardStats = {
    role,
    kpis: {
      openPos: 0,
      fulfilledPos: 0,
      activeSows: 0,
      completedSows: 0,
      productsPacked: 0,
      boxesPacked: 0,
      fulfillmentPct: null,
    },
    poStatusSlices: [],
    sowStatusSlices: [],
    progressSlices: [],
    packingTypeSlices: [],
    topPos: [],
    topSkus: [],
    deliverySoon: [],
    deliveryOverdue: [],
    recentActiveSows: [],
    showPo,
    showSow,
  };

  const poProgressList: Array<{
    poNumber: string;
    clientCode: string;
    estimatedDeliveryDate: Date | null | undefined;
    progress: Awaited<ReturnType<typeof buildPoProgress>>;
  }> = [];

  if (showPo) {
    const orders = await PurchaseOrder.find().sort({ createdAt: -1 });
    await Promise.all(
      orders.map(async (o) => {
        const progress = await buildPoProgress(o.poNumber, o.items || []);
        poProgressList.push({
          poNumber: o.poNumber,
          clientCode: o.clientCode,
          estimatedDeliveryDate: o.estimatedDeliveryDate,
          progress,
        });
      })
    );
  }

  let sowsWithStats: Array<{
    _id: string;
    sowNumber: string;
    poNumber: string;
    status: string;
    packingType: number;
    scannedQty: number;
    orderedQty: number;
    boxCount: number;
    progressItems: Array<{ sku: string; productName: string; scannedQty: number }>;
  }> = [];

  if (showSow) {
    const sows = await Sow.find().sort({ updatedAt: -1 });
    const ids = sows.map((s) => s._id);
    const boxes = await Box.find({ sowId: { $in: ids } });
    const poNumbers = [...new Set(sows.map((s) => s.poNumber))];
    const pos = await PurchaseOrder.find({ poNumber: { $in: poNumbers } });
    const poByNumber = new Map(pos.map((p) => [p.poNumber, p]));
    const namesBySku = new Map(
      (await ProductNameOption.find()).map((o) => [o.sku, o.name])
    );

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

    sowsWithStats = sows.map((sow) => {
      const stats = bySow.get(String(sow._id)) || {
        totalAmount: 0,
        boxCount: 0,
        bySku: new Map<string, number>(),
      };
      const po = poByNumber.get(sow.poNumber);
      const targets = resolveTargetItems(sow, po?.items || []);
      const orderedQty = targets.reduce((n, t) => n + t.targetQty, 0);
      const progressItems = targets.map((t) => ({
        sku: t.sku,
        productName: namesBySku.get(t.sku) || t.productName,
        scannedQty: stats.bySku.get(t.sku) || 0,
      }));
      return {
        _id: String(sow._id),
        sowNumber: sow.sowNumber,
        poNumber: sow.poNumber,
        status: sow.status,
        packingType: sow.packingType,
        scannedQty: stats.totalAmount,
        orderedQty,
        boxCount: stats.boxCount,
        progressItems,
      };
    });
  }

  const openPos = poProgressList.filter((p) => p.progress.status === 'open').length;
  const fulfilledPos = poProgressList.filter((p) => p.progress.status === 'fulfilled').length;

  const activeSows = sowsWithStats.filter((s) => s.status === 'packing').length;
  const completedSows = sowsWithStats.filter((s) => s.status === 'completed').length;
  const productsPacked = sowsWithStats.reduce((n, s) => n + s.scannedQty, 0);
  const boxesPacked = sowsWithStats.reduce((n, s) => n + s.boxCount, 0);

  let totalOrdered = 0;
  let totalScanned = 0;
  if (showSow) {
    for (const s of sowsWithStats) {
      if (s.orderedQty > 0) {
        totalOrdered += s.orderedQty;
        totalScanned += s.scannedQty;
      }
    }
  } else if (showPo) {
    for (const p of poProgressList) {
      totalOrdered += p.progress.orderedQty;
      totalScanned += p.progress.scannedQty;
    }
  }

  const fulfillmentPct = totalOrdered > 0 ? pct(totalScanned, totalOrdered) : null;

  const poStatusSlices: ChartSlice[] = [];
  if (openPos > 0) poStatusSlices.push({ name: 'Open', value: openPos, color: STATUS_COLORS.open });
  if (fulfilledPos > 0) {
    poStatusSlices.push({ name: 'Fulfilled', value: fulfilledPos, color: STATUS_COLORS.fulfilled });
  }

  const sowStatusCounts = { packing: 0, completed: 0, draft: 0 };
  for (const s of sowsWithStats) {
    if (s.status in sowStatusCounts) {
      sowStatusCounts[s.status as keyof typeof sowStatusCounts] += 1;
    }
  }
  const sowStatusSlices: ChartSlice[] = [];
  if (sowStatusCounts.packing > 0) {
    sowStatusSlices.push({ name: 'Packing', value: sowStatusCounts.packing, color: STATUS_COLORS.packing });
  }
  if (sowStatusCounts.completed > 0) {
    sowStatusSlices.push({
      name: 'Completed',
      value: sowStatusCounts.completed,
      color: STATUS_COLORS.completed,
    });
  }

  const activeOrdered = sowsWithStats
    .filter((s) => s.status === 'packing')
    .reduce((n, s) => n + s.orderedQty, 0);
  const activeScanned = sowsWithStats
    .filter((s) => s.status === 'packing')
    .reduce((n, s) => n + s.scannedQty, 0);
  const progressSlices: ChartSlice[] =
    activeOrdered > 0
      ? [
          { name: 'Scanned', value: activeScanned, color: '#1e3a8a' },
          { name: 'Remaining', value: Math.max(0, activeOrdered - activeScanned), color: '#dbeafe' },
        ]
      : [];

  const typeCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  for (const s of sowsWithStats) {
    if (s.packingType in typeCounts) typeCounts[s.packingType] += 1;
  }
  const packingTypeSlices: ChartSlice[] = ([1, 2, 3] as const)
    .filter((t) => typeCounts[t] > 0)
    .map((t) => ({
      name: PACKING_TYPE_LABELS[t],
      value: typeCounts[t],
      color: PACKING_TYPE_COLORS[t],
    }));

  const topPos: TopPoItem[] = poProgressList
    .map((p) => ({
      poNumber: p.poNumber,
      scanned: p.progress.scannedQty,
      ordered: p.progress.orderedQty,
      pct: pct(p.progress.scannedQty, p.progress.orderedQty),
    }))
    .sort((a, b) => b.scanned - a.scanned)
    .slice(0, 5);

  const skuMap = new Map<string, { productName: string; scanned: number }>();
  for (const s of sowsWithStats) {
    for (const item of s.progressItems) {
      const prev = skuMap.get(item.sku) || { productName: item.productName, scanned: 0 };
      prev.scanned += item.scannedQty;
      skuMap.set(item.sku, prev);
    }
  }
  const topSkus: TopSkuItem[] = [...skuMap.entries()]
    .map(([sku, { productName, scanned }]) => ({ sku, productName, scanned }))
    .sort((a, b) => b.scanned - a.scanned)
    .slice(0, 8);

  const today = startOfDay(new Date());
  const soonLimit = new Date(today.getTime() + 14 * MS_PER_DAY);

  const deliverySoon: DeliveryPoItem[] = [];
  const deliveryOverdue: DeliveryPoItem[] = [];

  for (const p of poProgressList) {
    if (p.progress.status === 'fulfilled' || !p.estimatedDeliveryDate) continue;
    const delivery = startOfDay(new Date(p.estimatedDeliveryDate));
    const item: DeliveryPoItem = {
      poNumber: p.poNumber,
      clientCode: p.clientCode,
      estimatedDeliveryDate: p.estimatedDeliveryDate.toISOString(),
      fulfillmentPct: pct(p.progress.scannedQty, p.progress.orderedQty),
      scannedQty: p.progress.scannedQty,
      orderedQty: p.progress.orderedQty,
    };
    if (delivery < today) {
      deliveryOverdue.push(item);
    } else if (delivery <= soonLimit) {
      deliverySoon.push(item);
    }
  }

  deliverySoon.sort(
    (a, b) =>
      new Date(a.estimatedDeliveryDate || 0).getTime() -
      new Date(b.estimatedDeliveryDate || 0).getTime()
  );
  deliveryOverdue.sort(
    (a, b) =>
      new Date(a.estimatedDeliveryDate || 0).getTime() -
      new Date(b.estimatedDeliveryDate || 0).getTime()
  );

  const recentActiveSows: RecentActiveSow[] = sowsWithStats
    .filter((s) => s.status === 'packing')
    .slice(0, 5)
    .map((s) => ({
      _id: s._id,
      sowNumber: s.sowNumber,
      poNumber: s.poNumber,
      progressPct: pct(s.scannedQty, s.orderedQty),
      scannedQty: s.scannedQty,
      orderedQty: s.orderedQty,
    }));

  return {
    ...empty,
    kpis: {
      openPos,
      fulfilledPos,
      activeSows,
      completedSows,
      productsPacked,
      boxesPacked,
      fulfillmentPct,
    },
    poStatusSlices,
    sowStatusSlices,
    progressSlices,
    packingTypeSlices,
    topPos,
    topSkus,
    deliverySoon,
    deliveryOverdue,
    recentActiveSows,
  };
}
