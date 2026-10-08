export interface QcInspectionResult {
  id: number;
  checklistItemId: number | null;
  description: string;
  specification?: string | null;
  isRequired?: boolean;
  passed: boolean | null;
  measuredValue: string | null;
  notes: string | null;
}
