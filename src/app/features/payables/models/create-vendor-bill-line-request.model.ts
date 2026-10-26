// ⚡ ACCOUNTING BOUNDARY — one line of a CreateVendorBillRequest. When the bill
// is PO-linked, every line must carry purchaseOrderLineId (and none may when
// the bill is standalone).
import { DocumentLineType } from '../../../shared/models/document-line-type.type';

export interface CreateVendorBillLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  accountDeterminationKey?: string;
  purchaseOrderLineId?: number;
  glAccountId?: number;
  lineType?: DocumentLineType;
  freightForPurchaseOrderId?: number;
}
