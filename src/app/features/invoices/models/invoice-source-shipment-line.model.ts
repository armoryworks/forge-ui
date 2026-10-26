import { DocumentLineType } from '../../../shared/models/document-line-type.type';

export interface InvoiceSourceShipmentLine {
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
  salesOrderLineId?: number | null;
  lineType?: DocumentLineType;
}
