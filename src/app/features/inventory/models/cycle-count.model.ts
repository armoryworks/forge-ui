import { CycleCountLine } from './cycle-count-line.model';

export interface CycleCount {
  id: number;
  locationId: number;
  locationName: string;
  countedById: number;
  countedByName: string;
  countedAt: string;
  status: string;
  notes: string | null;
  lines: CycleCountLine[];
  createdAt: string;
}
