import { DocumentLineType } from '../../../shared/models/document-line-type.type';

export interface CreateQuoteLineRequest {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
  lineType?: DocumentLineType;
}
