
export type UnitOfMeasure = 'SC' | 'KG' | 'BB' | 'CX' | 'FD' | 'L' | 'UN' | 'PT';
export type ProductType = 'RAW_MATERIAL' | 'FINISHED_GOOD';
export type AlertStatus = 'CRITICAL' | 'ATTENTION' | 'NORMAL';

export interface CostHistoryEntry {
  price: number;
  date: string;
}

export type UserRole = 'ADMIN' | 'VIEWER';

export interface User {
  id: string;
  name: string;
  username: string;
  password?: string;
  role: UserRole;
}

export interface Product {
  id: string;
  type: ProductType;
  code: string;
  ean?: string;
  dun?: string;
  name: string;
  category: string;
  unit: string;
  safetyStock: number;
  minStock: number;
  monthlyConsumption: number;
  currentStock: number;
  costPrice: number;
  salePrice: number;
  previousCostPrice?: number;
  costHistory?: CostHistoryEntry[];
}

export type TransactionType = 'ENTRADA' | 'SAÍDA' | 'AJUSTE';

export const TRANSACTION_TYPES: Record<string, TransactionType> = {
  ENTRY: 'ENTRADA',
  EXIT: 'SAÍDA',
  ADJUSTMENT: 'AJUSTE'
};

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  type: TransactionType;
  quantity: number;
  unitCost?: number;
  date: string;
  notes: string;
  userName: string;
}
