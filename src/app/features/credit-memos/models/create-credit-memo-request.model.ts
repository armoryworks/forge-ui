import { CreditMemoLineRequest } from './credit-memo-line-request.model';

export interface CreateCreditMemoRequest {
  customerId: number;
  invoiceId?: number | null;
  reasonType: string;
  reason: string;
  creditDate?: string | null;
  lines: CreditMemoLineRequest[];
  taxRate?: number | null;
  currencyId?: number | null;
  fxRate?: number | null;
  notes?: string | null;
}
