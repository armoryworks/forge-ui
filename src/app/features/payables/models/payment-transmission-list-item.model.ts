// ⚡ ACCOUNTING BOUNDARY — list projection of a PaymentTransmission for the
// finance-ops triage view. maxAttempts is the system constant (render "3/5").
export interface PaymentTransmissionListItem {
  id: number;
  sourceType: string;
  sourceId: number;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  lastError: string | null;
  submissionRef: string | null;
  amount: number;
  method: string;
  createdAt: string;
}
