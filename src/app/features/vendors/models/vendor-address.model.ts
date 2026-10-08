export interface VendorAddress {
  id: number;
  vendorId: number;
  addressType: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}
