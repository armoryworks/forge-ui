import { CreditMemoLineRequest } from './credit-memo-line-request.model';

export interface UpdateCreditMemoRequest {
  reasonType: string;
  reason: string;
  creditDate: string | null;
  lines: CreditMemoLineRequest[];
  taxRate?: number | null;
  notes?: string | null;
}
