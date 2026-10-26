import { VendorReturnLine } from './vendor-return-line.model';

/** A return to vendor opened by an NCR Return To Vendor disposition. */
export interface VendorReturnDetail {
  id: number;
  returnNumber: string;
  vendorId: number;
  vendorName: string;
  nonConformanceId: number | null;
  ncrNumber: string | null;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
  status: string;
  expectedCredit: number;
  currencyId: number;
  currencyCode: string | null;
  fxRate: number;
  shipDate: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  rmaNumber: string | null;
  notes: string | null;
  lines: VendorReturnLine[];
  vendorCreditMemoId: number | null;
  vendorCreditMemoNumber: string | null;
  createdAt: string;
  rowVersion: number;
}
