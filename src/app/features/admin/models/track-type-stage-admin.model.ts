export interface TrackTypeStageAdmin {
  id: number;
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  wipLimit: number | null;
  isIrreversible: boolean;
  isMandatory: boolean;
  accountingDocumentType: string | null;
  isActive: boolean;
  openJobCount: number;
}
