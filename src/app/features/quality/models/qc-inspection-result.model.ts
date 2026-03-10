export interface QcInspectionResult {
  id: number;
  checklistItemId: number | null;
  description: string;
  passed: boolean;
  measuredValue: string | null;
  notes: string | null;
}
