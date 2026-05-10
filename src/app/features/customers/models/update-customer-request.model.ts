export interface UpdateCustomerRequest {
  name?: string;
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
