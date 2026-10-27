import { ControlledDocumentStatus } from './controlled-document-status.model';

export interface ControlledDocument {
  id: number;
  documentNumber: string;
  title: string;
  description: string | null;
  category: string;
  currentRevision: number;
  status: ControlledDocumentStatus;
  ownerId: number;
  checkedOutById: number | null;
  checkedOutAt: string | null;
  releasedAt: string | null;
  reviewDueDate: string | null;
  reviewIntervalDays: number;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;
  partId: number | null;
  partNumber: string | null;
  operationId: number | null;
  operationLabel: string | null;
}
