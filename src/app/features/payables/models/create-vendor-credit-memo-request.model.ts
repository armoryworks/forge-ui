import { VendorCreditMemoLineRequest } from './vendor-credit-memo-line-request.model';

export interface CreateVendorCreditMemoRequest {
  vendorId: number;
  kind: string;
  sourceType: string;
  reason: string;
  vendorReference: string | null;
  vendorBillId: number | null;
  currencyId: number | null;
  fxRate: number | null;
  memoDate: string | null;
  taxAmount: number | null;
  notes: string | null;
  lines: VendorCreditMemoLineRequest[];
}
