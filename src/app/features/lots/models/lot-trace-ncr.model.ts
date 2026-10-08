export interface LotTraceNcr {
  id: number;
  ncrNumber: string;
  type: string;
  status: string;
  detectedAt: Date;
  description: string;
  affectedQuantity: number;
  dispositionCode: string | null;
}
