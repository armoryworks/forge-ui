export interface MaterialSpec {
  id: number;
  code: string;
  label: string;
  parentId: number | null;
  categoryLabel: string | null;
  sortOrder: number;
  isActive: boolean;
  isSeedData: boolean;
  partCount: number;
}
