export interface UpdateCustomerRequest {
  name?: string;
  /** User-settable business number. Only honored server-side when
   *  `customers.allow_manual_numbers` is enabled; blank/undefined leaves it alone. */
  customerNumber?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  isActive?: boolean;
  // Phase 1r / Batch 15-16 — regulated-industry flags + reference-customer consent.
  isFdaRegulated?: boolean;
  isAerospace?: boolean;
  isAutomotive?: boolean;
  isItarControlled?: boolean;
  isReferenceOk?: boolean;
  referenceNotes?: string;
}
