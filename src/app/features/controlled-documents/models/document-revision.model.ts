import { DocumentRevisionStatus } from './document-revision-status.model';

export interface DocumentRevision {
  id: number;
  documentId: number;
  revisionNumber: number;
  fileAttachmentId: number;
  changeDescription: string;
  authoredById: number;
  reviewedById: number | null;
  approvedById: number | null;
  approvedAt: string | null;
  status: DocumentRevisionStatus;
  authoredByName: string | null;
  approvedByName: string | null;
  fileName: string | null;
}
