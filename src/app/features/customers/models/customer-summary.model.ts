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
  // Phase 1r / Batch 15-16 — regulated-industry flags + reference-customer consent.
  isFdaRegulated?: boolean;
  isAerospace?: boolean;
  isAutomotive?: boolean;
  isItarControlled?: boolean;
  isReferenceOk?: boolean;
  referenceNotes?: string | null;
}
