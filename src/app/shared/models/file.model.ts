export interface FileAttachment {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
  entityType: string;
  entityId: number;
  uploadedById: number;
  uploadedByName: string;
  createdAt: Date;
}
