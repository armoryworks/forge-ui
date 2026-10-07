export interface CreateVendorRequest {
  companyName: string;
  /** Honored only when `vendors.allow_manual_numbers` is enabled; otherwise auto-numbered. */
  vendorNumber?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  fax?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  paymentTerms?: string;
  notes?: string;
  is1099?: boolean;
  taxId?: string;
}
