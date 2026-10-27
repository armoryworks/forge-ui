import { VendorReturnCreditLineRequest } from './vendor-return-credit-line-request.model';

export interface RecordVendorReturnCreditRequest {
  vendorReference: string | null;
  memoDate: string | null;
  notes: string | null;
  lines: VendorReturnCreditLineRequest[] | null;
}
