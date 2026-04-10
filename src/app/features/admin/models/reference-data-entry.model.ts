export interface ReferenceDataEntry {
  id: number;
  code: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  isSeedData: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  metadata: string | null;
}
