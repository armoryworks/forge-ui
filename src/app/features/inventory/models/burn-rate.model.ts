export interface BurnRate {
  partId: number;
  partNumber: string;
  partDescription: string;
  preferredVendorId: number | null;
  preferredVendorName: string | null;
  onHandStock: number;
  availableStock: number;
  incomingPoQuantity: number;
  earliestPoArrival: string | null;
  burnRate30Day: number | null;
  burnRate60Day: number | null;
  burnRate90Day: number | null;
  daysOfStockRemaining: number | null;
  projectedStockoutDate: string | null;
  minStockThreshold: number | null;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  safetyStockDays: number | null;
  needsReorder: boolean;
}
