export interface PartRevision {
  id: number;
  partId: number;
  revision: string;
  changeDescription: string | null;
  changeReason: string | null;
  effectiveDate: Date;
  isCurrent: boolean;
  fileCount: number;
  createdAt: Date;
}
