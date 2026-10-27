export interface OperationQuantityEntry {
  completed: number;
  scrap: number;
  rework: number;
  reason: string | null;
  complete: boolean;
  bookReworkTime?: boolean;
}
