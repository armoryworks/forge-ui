export interface UpdateVendorRequest {
  companyName?: string;
  /**
   * User-settable business number. Sent only when manual vendor numbers are
   * enabled (`vendors.allow_manual_numbers`); omit/undefined to leave the
   * current number untouched.
   */
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
  isActive?: boolean;
  /** 1099 payee flag; omit to leave the stored value untouched. */
  is1099?: boolean;
  /** Vendor TIN/EIN/SSN for 1099 filing; omit to leave untouched, empty string to clear. */
  taxId?: string | null;
  // Bought-parts effort PR4 — per-vendor override for the off-tier price
  // prompt threshold. Null = use system default (`purchasing.offTierVariancePct`,
  // 5% out of the box). Wider tolerance silences prompts for vendors with
  // genuinely noisy pricing.
  offTierVariancePct?: number | null;
}
