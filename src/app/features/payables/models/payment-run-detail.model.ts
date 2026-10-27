import { PaymentRunItem } from './payment-run-item.model';

export interface PaymentRunDetail {
  id: number;
  runNumber: string;
  status: string;
  paymentDate: string;
  method: string;
  referenceNumber: string | null;
  notes: string | null;
  applyVendorCredits: boolean;
  lastError: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  items: PaymentRunItem[];
}
