export interface PaymentTermsSummary {
  id: number;
  code: string;
  name: string;
  netDays: number;
  discountPercent: number;
  discountDays: number;
}
