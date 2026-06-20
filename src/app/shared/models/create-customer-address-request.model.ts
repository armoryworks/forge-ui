/** Payload for POST /customers/{customerId}/addresses. Mirrors CreateCustomerAddressRequestModel. */
export interface CreateCustomerAddressRequest {
  label: string;
  addressType: string; // 'Billing' | 'Shipping' | 'Both'
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}
