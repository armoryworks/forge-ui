export interface DowntimeLog {
  id: number;
  assetId: number;
  assetName: string;
  reportedById: number | null;
  startedAt: Date;
  endedAt: Date | null;
  reason: string;
  resolution: string | null;
  isPlanned: boolean;
  notes: string | null;
  durationHours: number;
  createdAt: Date;
}
