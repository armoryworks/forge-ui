export interface StopOperationTimerRequest {
  notes?: string | null;
  goodQuantity?: number | null;
  scrapQuantity?: number | null;
  markComplete?: boolean;
  reasonCode?: string | null;
}
