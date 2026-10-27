import { ControlledDocumentCategory } from './controlled-document-category.model';

export interface CreateControlledDocumentRequest {
  title: string;
  description: string | null;
  category: ControlledDocumentCategory;
  reviewIntervalDays: number;
  partId: number | null;
  operationId: number | null;
}
