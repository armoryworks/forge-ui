import { VendorCreditMemoLineRequest } from './vendor-credit-memo-line-request.model';

export interface UpdateVendorCreditMemoRequest {
  kind: string;
  sourceType: string;
  reason: string;
  vendorReference: string | null;
  memoDate: string;
  taxAmount: number | null;
  notes: string | null;
  lines: VendorCreditMemoLineRequest[];
}
