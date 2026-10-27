export interface WorkInstruction {
  documentId: number;
  documentNumber: string;
  title: string;
  description: string | null;
  revisionId: number;
  revisionNumber: number;
  fileAttachmentId: number;
  fileName: string;
  contentType: string;
  approvedAt: string | null;
  partId: number | null;
  operationId: number | null;
}
