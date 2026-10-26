import { FreightTerms } from '../../../shared/models/freight-terms.const';

export interface CustomerSummary {
  id: number;
  name: string;
  /** Human-readable business number (auto-generated, or manual when enabled). */
  customerNumber?: string;
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
  creditLimit?: number | null;
  isTaxExempt?: boolean;
  taxExemptionId?: string | null;
  rowVersion?: number;
  freightTerms?: FreightTerms | null;
  defaultCreditTerms?: string | null;
  isOnCreditHold?: boolean;
  currencyId?: number | null;
  currencyLocked?: boolean;
}
