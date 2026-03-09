export interface ReferenceDataEntry {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  metadata: string | null;
}
