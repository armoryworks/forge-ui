export interface LaborRecomputeRequest {
  from: string;
  to: string;
  userId?: number | null;
  preview: boolean;
}
