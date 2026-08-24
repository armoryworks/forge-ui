import { PurchaseOrderListItem } from '../../purchase-orders/models/purchase-order-list-item.model';

export interface VendorDetail {
  id: number;
  companyName: string;
  vendorNumber: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  paymentTerms: string | null;
  notes: string | null;
  isActive: boolean;
  /** Marks the vendor as a 1099 payee (drives the 1099 report). */
  is1099: boolean;
  /** Vendor TIN/EIN/SSN for 1099 filing; full value, masked on display. */
  taxId: string | null;
  externalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  purchaseOrders: PurchaseOrderListItem[];
  // Bought-parts effort PR4 — per-vendor override for the off-tier
  // prompt threshold. Null = use the system default. Surfaced in the
  // vendor edit dialog so admins can widen tolerance for vendors with
  // genuinely noisy pricing.
  offTierVariancePct: number | null;
}
