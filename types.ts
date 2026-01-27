
export type UnitOfMeasure = 'SC' | 'KG' | 'BB' | 'CX' | 'FD' | 'L';

export interface CostHistoryEntry {
  price: number;
  date: string;
}

export interface Product {
  id: string; // Internal UUID
  code: string; // COD from PDF
  name: string;
  category: string; // Categoria do produto
  unit: string;
  safetyStock: number;
  minStock: number;
  monthlyConsumption: number;
  currentStock: number;
  previousStock: number;
  costPrice: number; // Preço de custo por unidade
  salePrice: number; // Preço de venda unitário
  previousCostPrice?: number; // Preço de custo anterior para alertas
  costHistory?: CostHistoryEntry[]; // Histórico dos últimos preços
}

export enum TransactionType {
  ENTRY = 'ENTRADA',
  EXIT = 'SAÍDA',
  ADJUSTMENT = 'AJUSTE'
}

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  type: TransactionType;
  quantity: number;
  unitCost?: number; // Custo unitário no momento da transação
  date: string;
  notes: string;
}

export interface ExportData {
  products: Product[];
  transactions: Transaction[];
}
