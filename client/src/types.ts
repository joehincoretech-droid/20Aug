export type UserRole = 'admin' | 'worker' | 'po';

export interface User {
  _id: string;
  username: string;
  role: UserRole;
  createdAt?: string;
  passwordChangedAt?: string;
  passwordDaysUsed?: number;
  passwordExpired?: boolean;
  passwordMaxAgeDays?: number;
}

export interface SkuLabel {
  sku: string;
  productName: string;
  boxesPerOuterBox?: number;
}

export type SowStatus = 'draft' | 'in_progress' | 'packing' | 'completed' | string;

export interface TargetItem {
  sku: string;
  productName: string;
  targetQty: number;
}

export interface SkuProgress {
  sku: string;
  productName: string;
  orderedQty: number;
  scannedQty: number;
  remainingQty?: number;
  poRemaining?: number;
}

export interface Sow {
  _id: string;
  sowNumber: string;
  poNumber: string;
  batchNo: string;
  clientCode: string;
  packingType: 1 | 2 | 3;
  packingTypeLabel?: string;
  selectedSKUs: string[];
  selectedSKULabels?: SkuLabel[];
  targetItems?: TargetItem[];
  totalAmount?: number;
  scannedQty?: number;
  orderedQty?: number | null;
  progressItems?: SkuProgress[];
  productOrder?: string;
  status: SowStatus;
  completedAt?: string;
  completedBy?: { username?: string } | null;
}

export interface BoxProduct {
  sku: string;
  productId: string;
  productName: string;
  packedAt?: string;
}

export interface Box {
  _id?: string;
  boxId: string;
  palletId?: string | null;
  products: BoxProduct[];
  completed?: boolean;
  status?: string;
}

export interface Pallet {
  _id?: string;
  palletId: string;
  boxes: string[];
}

export interface ProductName {
  _id: string;
  sku: string;
  name: string;
  boxesPerOuterBox: number;
}

export interface AuditLog {
  _id: string;
  timestamp: string;
  userId?: { username?: string } | null;
  actionType: string;
  details?: unknown;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  clientCode: string;
  estimatedDeliveryDate?: string;
  productOrder?: string;
  createdAt: string;
  createdBy?: { username?: string } | null;
  selectedSKUs?: string[];
  items?: Array<{ sku: string; productName: string; qty: number }>;
  orderedQty?: number;
  scannedQty?: number;
  remainingQty?: number;
  status?: 'open' | 'fulfilled' | string;
  sowCount?: number;
  sowNumbers?: string[];
  sows?: Array<{ _id: string; sowNumber: string }>;
  progressItems?: SkuProgress[];
}

export interface PoClientLookup {
  clientCode?: string;
  selectedSKUs?: string[];
  productOrder?: string;
  items?: Array<{ sku: string; productName: string; qty: number }>;
  orderedQty?: number;
  scannedQty?: number;
  remainingQty?: number;
  status?: 'open' | 'fulfilled' | string;
  progressItems?: SkuProgress[];
}

export interface ChartSlice {
  name: string;
  value: number;
  color: string;
}

export interface DashboardTopPo {
  poNumber: string;
  scanned: number;
  ordered: number;
  pct: number;
}

export interface DashboardTopSku {
  sku: string;
  productName: string;
  scanned: number;
}

export interface DashboardDeliveryPo {
  poNumber: string;
  clientCode: string;
  estimatedDeliveryDate: string | null;
  fulfillmentPct: number;
  scannedQty: number;
  orderedQty: number;
}

export interface DashboardRecentSow {
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
  topPos: DashboardTopPo[];
  topSkus: DashboardTopSku[];
  deliverySoon: DashboardDeliveryPo[];
  deliveryOverdue: DashboardDeliveryPo[];
  recentActiveSows: DashboardRecentSow[];
  showPo: boolean;
  showSow: boolean;
}
