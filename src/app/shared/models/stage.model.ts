export interface Stage {
  id: number;
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  wipLimit: number | null;
  accountingDocumentType: string | null;
  isIrreversible: boolean;
}
