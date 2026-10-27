import { FreightTerms } from '../../../shared/models/freight-terms.const';

export interface UpdateCustomerRequest {
  name?: string;
  /** User-settable business number. Only honored server-side when
   *  `customers.allow_manual_numbers` is enabled; blank/undefined leaves it alone. */
  customerNumber?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  isActive?: boolean;
  // Phase 1r / Batch 15-16 — regulated-industry flags + reference-customer consent.
  isFdaRegulated?: boolean;
  isAerospace?: boolean;
  isAutomotive?: boolean;
  isItarControlled?: boolean;
  isReferenceOk?: boolean;
  requiresCoa?: boolean;
  referenceNotes?: string;
  isTaxExempt?: boolean;
  taxExemptionId?: string;
  creditLimit?: number;
  clearCreditLimit?: boolean;
  defaultCreditTerms?: string;
  clearDefaultCreditTerms?: boolean;
  paymentTermsId?: number;
  currencyId?: number;
  clearCurrency?: boolean;
  freightTerms?: FreightTerms;
  clearFreightTerms?: boolean;
  defaultTaxCodeId?: number;
  clearDefaultTaxCode?: boolean;
}
