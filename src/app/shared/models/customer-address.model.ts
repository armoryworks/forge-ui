/** A customer's saved address (billing/shipping). Mirrors CustomerAddressResponseModel. */
export interface CustomerAddress {
  id: number;
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
