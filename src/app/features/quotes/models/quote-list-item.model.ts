export interface QuoteListItem {
  id: number;
  quoteNumber: string;
  customerId: number;
  customerName: string;
  status: string;
  lineCount: number;
  total: number;
  expirationDate: Date | null;
  createdAt: Date;
  currencyId?: number | null;
  currencyCode?: string | null;
  fxRate?: number;
  totalFunctional?: number | null;
}
