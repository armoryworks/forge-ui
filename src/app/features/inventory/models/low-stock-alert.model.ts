export interface LowStockAlert {
  partId: number;
  partNumber: string;
  description: string;
  currentStock: number;
  minStockThreshold: number | null;
  reorderPoint: number | null;
}
