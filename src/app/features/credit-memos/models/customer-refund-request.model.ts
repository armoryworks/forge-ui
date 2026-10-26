export interface CustomerRefundRequest {
  amount: number;
  method: string;
  refundDate: string;
  reference?: string | null;
  settlementFxRate?: number | null;
  notes?: string | null;
}
