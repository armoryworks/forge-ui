export interface LowStockAlert {
  partId: number;
  partNumber: string;
  description: string;
  currentStock: number;
  minStockThreshold: number;
  reorderPoint: number | null;
}
