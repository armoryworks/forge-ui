export interface PaymentTermRequest {
  code: string;
  name: string;
  netDays: number;
  discountPercent: number;
  discountDays: number;
  isActive: boolean;
  sortOrder: number;
}
