export interface Stage {
  id: number;
  name: string;
  code: string;
  sortOrder: number;
  color: string;
  wipLimit: number | null;
  accountingDocumentType: string | null;
  isIrreversible: boolean;
  /** Forward moves may not skip over an active mandatory stage. */
  isMandatory: boolean;
}
