export type UserRole = 'admin' | 'worker' | 'po';

export interface User {
  _id: string;
  username: string;
  role: UserRole;
  createdAt?: string;
}

export interface SkuLabel {
  sku: string;
  productName: string;
}

export type SowStatus = 'draft' | 'in_progress' | 'completed' | string;

export interface SkuProgress {
  sku: string;
  productName: string;
  orderedQty: number;
  scannedQty: number;
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
  productOrder?: string;
  createdAt: string;
  createdBy?: { username?: string } | null;
  selectedSKUs?: string[];
  items?: Array<{ sku: string; productName: string; qty: number }>;
  orderedQty?: number;
  scannedQty?: number;
  sowCount?: number;
  sowNumbers?: string[];
  progressItems?: SkuProgress[];
}

export interface PoClientLookup {
  clientCode?: string;
  selectedSKUs?: string[];
  productOrder?: string;
}
