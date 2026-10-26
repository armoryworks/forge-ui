import { CreditMemoApplication } from './credit-memo-application.model';
import { CreditMemoLine } from './credit-memo-line.model';
import { CustomerRefund } from './customer-refund.model';

export interface CreditMemoDetail {
  id: number;
  creditMemoNumber: string;
  customerId: number;
  customerName: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  customerReturnId: number | null;
  returnNumber: string | null;
  reasonType: string;
  reason: string;
  status: string;
  creditDate: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountApplied: number;
  amountRefunded: number;
  openAmount: number;
  currencyId: number;
  currencyCode: string | null;
  fxRate: number;
  notes: string | null;
  issuedAt: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  issueJournalEntryId: number | null;
  lines: CreditMemoLine[];
  applications: CreditMemoApplication[];
  refunds: CustomerRefund[];
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}
