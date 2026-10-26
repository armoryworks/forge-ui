export interface CustomerRefund {
  id: number;
  refundNumber: string;
  customerId: number;
  amount: number;
  method: string;
  refundDate: string;
  reference: string | null;
  status: string;
  creditMemoId: number | null;
  creditMemoNumber: string | null;
  paymentId: number | null;
  paymentNumber: string | null;
  currencyCode: string | null;
  fxRate: number;
}
