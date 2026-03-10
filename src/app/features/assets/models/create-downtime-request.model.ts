export interface CreateDowntimeRequest {
  assetId: number;
  startedAt: string;
  endedAt: string | null;
  reason: string;
  resolution: string | null;
  isPlanned: boolean;
  notes: string | null;
}
