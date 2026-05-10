export interface PortalIdentity {
  contactId: number;
  customerId: number;
  customerName: string;
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string | null;
}

export interface PortalSession {
  token: string;
  expiresAt: string;
  identity: PortalIdentity;
}

export interface PortalSummary {
  openSalesOrderCount: number;
  openQuoteCount: number;
  openInvoiceCount: number;
  inTransitShipmentCount: number;
}

export interface PortalSalesOrder {
  id: number;
  orderNumber: string;
  status: string;
  orderDate: string;
  requestedDate: string | null;
  total: number;
}

export interface PortalQuote {
  id: number;
  quoteNumber: string;
  quoteType: string;
  status: string;
  quoteDate: string;
  expiresAt: string | null;
  total: number;
}

export interface PortalInvoice {
  id: number;
  invoiceNumber: string;
  status: string;
  invoiceDate: string;
  dueDate: string | null;
  total: number;
  amountPaid: number;
  balance: number;
}

export interface PortalShipment {
  id: number;
  shipmentNumber: string;
  status: string;
  shippedDate: string | null;
  deliveredDate: string | null;
  carrier: string | null;
  trackingNumber: string | null;
}

export interface RequestMagicLinkResult {
  /** Populated only when the install hasn't configured SMTP. Lets the
   *  developer click the link directly without going through email. */
  devLink: string | null;
}
