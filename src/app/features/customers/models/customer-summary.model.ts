export interface CustomerSummary {
  id: number;
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  externalId?: string;
  externalRef?: string;
  provider?: string;
  createdAt: string;
  updatedAt: string;
  estimateCount: number;
  quoteCount: number;
  orderCount: number;
  activeJobCount: number;
  openInvoiceCount: number;
  openInvoiceTotal: number;
  ytdRevenue: number;
}
