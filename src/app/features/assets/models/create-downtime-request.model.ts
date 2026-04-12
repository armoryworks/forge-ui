export interface CreateDowntimeRequest {
  assetId: number;
  workCenterId: number | null;
  startedAt: string;
  endedAt: string | null;
  category: string | null;
  downtimeReasonId: number | null;
  reason: string;
  resolution: string | null;
  description: string | null;
  isPlanned: boolean;
  jobId: number | null;
  notes: string | null;
}
