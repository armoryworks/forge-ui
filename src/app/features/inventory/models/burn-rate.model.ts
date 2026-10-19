export interface BurnRate {
  partId: number;
  partNumber: string;
  description: string;
  preferredVendorId: number | null;
  preferredVendorName: string | null;
  onHand: number;
  available: number;
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
