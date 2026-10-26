export interface CreditMemoListItem {
  id: number;
  creditMemoNumber: string;
  customerId: number;
  customerName: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  reasonType: string;
  reason: string;
  status: string;
  creditDate: string;
  total: number;
  openAmount: number;
  currencyId: number;
  currencyCode: string | null;
  fxRate: number;
  createdAt: string;
}
