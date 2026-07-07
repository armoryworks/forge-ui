/** Payload for PUT /customers/{customerId}/addresses/{addressId}. Mirrors UpdateCustomerAddressRequestModel. */
export interface UpdateCustomerAddressRequest {
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
