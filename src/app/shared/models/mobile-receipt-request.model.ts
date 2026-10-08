import { MobileReceiptLine } from './mobile-receipt-line.model';

export interface MobileReceiptRequest {
  lines: MobileReceiptLine[];
  packingSlipNumber: string | null;
}
