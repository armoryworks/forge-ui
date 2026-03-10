export interface PartRevision {
  id: number;
  partId: number;
  revision: string;
  changeDescription: string | null;
  changeReason: string | null;
  effectiveDate: string;
  isCurrent: boolean;
  fileCount: number;
  createdAt: string;
}
