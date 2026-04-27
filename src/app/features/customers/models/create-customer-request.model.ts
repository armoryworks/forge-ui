/**
 * Customer-create payload. Phase 3 F3 extends with full-record fields so
 * the customer-onboarding form captures credit limit, default tax/currency,
 * and billing/shipping addresses in one POST instead of forcing a follow-up
 * PATCH. All new fields are optional so existing call sites compile unchanged.
 */
export interface CreateCustomerRequest {
  name: string;
  companyName?: string;
  email?: string;
  phone?: string;
  // F3 — full-record fields. All optional.
  creditLimit?: number;
  defaultTaxCodeId?: number;
  defaultCurrency?: string;
  billingAddress?: AddressInput;
  shippingAddress?: AddressInput;
  isTaxExempt?: boolean;
  taxExemptionId?: string;
}

export interface AddressInput {
  street: string;
  line2?: string;
  city: string;
  state: string;
  postal: string;
  country?: string;
}
