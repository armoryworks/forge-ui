export interface PaymentRunListItem {
  id: number;
  runNumber: string;
  status: string;
  paymentDate: string;
  method: string;
  itemCount: number;
  paidCount: number;
  failedCount: number;
  pendingCount: number;
  cashTotal: number;
  creditTotal: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
}
