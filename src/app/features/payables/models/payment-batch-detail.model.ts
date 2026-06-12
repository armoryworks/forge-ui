import { PaymentBatchItem } from './payment-batch-item.model';
import { PaymentBatchListItem } from './payment-batch-list-item.model';

// ⚡ BANKING BOUNDARY — full batch projection (header + entry lines).
export interface PaymentBatchDetail extends PaymentBatchListItem {
  generatedAt: string | null;
  hasFile: boolean;
  items: PaymentBatchItem[];
}
