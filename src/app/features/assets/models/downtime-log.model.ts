import { DowntimeCategory } from './downtime-category.type';

export interface DowntimeLog {
  id: number;
  assetId: number;
  assetName: string;
  workCenterId: number | null;
  reportedById: number | null;
  startedAt: Date;
  endedAt: Date | null;
  category: DowntimeCategory | null;
  reason: string;
  resolution: string | null;
  isPlanned: boolean;
  notes: string | null;
  durationHours: number;
  createdAt: Date;
}
