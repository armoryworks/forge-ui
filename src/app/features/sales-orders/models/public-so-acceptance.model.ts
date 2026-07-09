/**
 * Anonymous public view of a sales order awaiting customer acceptance,
 * returned by `GET /api/v1/public/so-acceptance/{token}`. Rendered on the
 * unauthenticated `/accept/:token` page the customer opens from their email.
 */
export interface PublicSoAcceptanceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface PublicSoAcceptance {
  orderNumber: string;
  customerName: string;
  companyName: string;
  requiresKey: boolean;
  alreadyResponded: boolean;
  status: string;
  lines: PublicSoAcceptanceLine[];
  total: number;
}
