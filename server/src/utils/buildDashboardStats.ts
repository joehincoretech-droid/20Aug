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

export interface TopSkuItem {
  sku: string;
  productName: string;
  orderedQty: number;
  pendingUnits: number;
  completedUnits: number;
}

export interface PoSkuOrderGroup {
  poNumber: string;
  clientCode: string;
  estimatedDeliveryDate: string | null;
  totalOrderedQty: number;
  skus: TopSkuItem[];
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
}

export interface DashboardStats {
  role: UserRole;
  kpis: DashboardKpis;
  poStatusSlices: ChartSlice[];
  sowStatusSlices: ChartSlice[];
  skuOrdersByPo: PoSkuOrderGroup[];
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
    },
    poStatusSlices: [],
    sowStatusSlices: [],
    skuOrdersByPo: [],
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

  let skuOrdersByPo: PoSkuOrderGroup[] = [];
  if (showSow) {
    const namesBySku = new Map(
      (await ProductNameOption.find()).map((o) => [o.sku, o.name])
    );

    const completedByPoSku = new Map<string, Map<string, number>>();
    for (const s of sowsWithStats) {
      if (s.status !== 'completed') continue;
      for (const item of s.progressItems) {
        const bySku = completedByPoSku.get(s.poNumber) || new Map<string, number>();
        bySku.set(item.sku, (bySku.get(item.sku) || 0) + item.scannedQty);
        completedByPoSku.set(s.poNumber, bySku);
      }
    }

    const poSources: Array<{
      poNumber: string;
      clientCode: string;
      estimatedDeliveryDate: Date | null | undefined;
      lines: Array<{ sku: string; productName: string; orderedQty: number }>;
    }> = [];

    if (poProgressList.length > 0) {
      for (const p of poProgressList) {
        poSources.push({
          poNumber: p.poNumber,
          clientCode: p.clientCode,
          estimatedDeliveryDate: p.estimatedDeliveryDate,
          lines: p.progress.items.map((item) => ({
            sku: item.sku,
            productName: item.productName,
            orderedQty: item.orderedQty,
          })),
        });
      }
    } else {
      const orders = await PurchaseOrder.find().select(
        'poNumber clientCode estimatedDeliveryDate items'
      );
      for (const o of orders) {
        poSources.push({
          poNumber: o.poNumber,
          clientCode: o.clientCode,
          estimatedDeliveryDate: o.estimatedDeliveryDate,
          lines: (o.items || []).map((item) => ({
            sku: item.sku,
            productName: item.productName,
            orderedQty: item.qty || 0,
          })),
        });
      }
    }

    skuOrdersByPo = poSources
      .map((po) => {
        const completedForPo = completedByPoSku.get(po.poNumber) || new Map<string, number>();
        const skus: TopSkuItem[] = po.lines
          .filter((line) => line.orderedQty > 0)
          .map((line) => {
            const rawCompleted = completedForPo.get(line.sku) || 0;
            const completedUnits = Math.min(rawCompleted, line.orderedQty);
            const pendingUnits = Math.max(0, line.orderedQty - completedUnits);
            return {
              sku: line.sku,
              productName: line.productName || namesBySku.get(line.sku) || line.sku,
              orderedQty: line.orderedQty,
              pendingUnits,
              completedUnits,
            };
          })
          .sort((a, b) => b.orderedQty - a.orderedQty);
        if (skus.length === 0) return null;
        return {
          poNumber: po.poNumber,
          clientCode: po.clientCode,
          estimatedDeliveryDate: po.estimatedDeliveryDate
            ? po.estimatedDeliveryDate.toISOString()
            : null,
          totalOrderedQty: skus.reduce((n, s) => n + s.orderedQty, 0),
          skus,
        };
      })
      .filter((group): group is PoSkuOrderGroup => group != null)
      .sort((a, b) => {
        const aTime = a.estimatedDeliveryDate
          ? new Date(a.estimatedDeliveryDate).getTime()
          : Number.POSITIVE_INFINITY;
        const bTime = b.estimatedDeliveryDate
          ? new Date(b.estimatedDeliveryDate).getTime()
          : Number.POSITIVE_INFINITY;
        if (aTime !== bTime) return aTime - bTime;
        return a.poNumber.localeCompare(b.poNumber);
      });
  }

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
    },
    poStatusSlices,
    sowStatusSlices,
    skuOrdersByPo,
    deliverySoon,
    deliveryOverdue,
    recentActiveSows,
  };
}
