import { VendorCreditMemoApplication } from './vendor-credit-memo-application.model';
import { VendorCreditMemoLine } from './vendor-credit-memo-line.model';

export interface VendorCreditMemoDetail {
  id: number;
  memoNumber: string;
  kind: string;
  vendorId: number;
  vendorName: string;
  vendorBillId: number | null;
  vendorBillNumber: string | null;
  vendorReturnId: number | null;
  vendorReturnNumber: string | null;
  sourceType: string;
  reason: string;
  vendorReference: string | null;
  status: string;
  memoDate: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountApplied: number;
  openAmount: number;
  currencyId: number;
  currencyCode: string | null;
  fxRate: number;
  notes: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  issueJournalEntryId: number | null;
  lines: VendorCreditMemoLine[];
  applications: VendorCreditMemoApplication[];
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}
