import { AddressInput } from '../../customers/models/create-customer-request.model';

/**
 * Wave 2 — convert-lead payload. Captures the customer-required fields
 * the user fills in via the convert-lead stepper so the resulting Customer
 * is fully populated atomically rather than as a shell record needing
 * follow-up patches. All optional except `createJob`.
 */
export interface ConvertLeadRequest {
  createJob: boolean;
  creditLimit?: number;
  isTaxExempt?: boolean;
  taxExemptionId?: string;
  defaultTaxCodeId?: number;
  defaultCurrency?: string;
  billingAddress?: AddressInput;
  shippingAddress?: AddressInput;
}
