export interface DowntimeLog {
  id: number;
  assetId: number;
  assetName: string;
  workCenterId: number | null;
  reportedById: number | null;
  startedAt: Date;
  endedAt: Date | null;
  category: string | null;
  downtimeReasonId: number | null;
  reason: string;
  resolution: string | null;
  description: string | null;
  isPlanned: boolean;
  jobId: number | null;
  notes: string | null;
  durationHours: number;
  createdAt: Date;
}
