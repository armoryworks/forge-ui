export interface InventoryLevelItem {
  partId: number;
  partNumber: string;
  description: string;
  currentStock: number;
  minStockThreshold: number | null;
  reorderPoint: number | null;
  isLowStock: boolean;
}
