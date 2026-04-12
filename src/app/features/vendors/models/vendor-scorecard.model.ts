export type VendorGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface VendorScorecard {
  vendorId: number;
  vendorName: string;
  periodStart: string;
  periodEnd: string;
  totalPurchaseOrders: number;
  totalLinesReceived: number;
  onTimeDeliveryPercent: number;
  lateDeliveries: number;
  qualityAcceptancePercent: number;
  totalInspected: number;
  totalRejected: number;
  totalNcrs: number;
  totalSpend: number;
  avgPriceVariancePercent: number;
  quantityAccuracyPercent: number;
  overallScore: number;
  grade: VendorGrade;
}

export interface VendorComparisonRow {
  vendorId: number;
  vendorName: string;
  onTimePercent: number;
  qualityPercent: number;
  totalSpend: number;
  overallScore: number;
  grade: VendorGrade;
  trend: string;
}
