export interface CycleCountLine {
  id: number;
  binContentId: number | null;
  entityType: string;
  entityId: number;
  entityName: string;
  expectedQuantity: number;
  actualQuantity: number;
  variance: number;
  notes: string | null;
}
