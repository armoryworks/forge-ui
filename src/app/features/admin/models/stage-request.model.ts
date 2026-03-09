export interface StageRequest {
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  wipLimit: number | null;
  isIrreversible: boolean;
}
