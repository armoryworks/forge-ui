import { DocumentLineType } from '../../../shared/models/document-line-type.type';

export interface CreateInvoiceLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  notes?: string;
  salesOrderLineId?: number;
  lineType?: DocumentLineType;
}
