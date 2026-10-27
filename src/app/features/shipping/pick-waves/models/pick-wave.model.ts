import { PickLine } from './pick-line.model';
import { PickWaveStatus } from './pick-wave-status.model';
import { PickWaveStrategy } from './pick-wave-strategy.model';

/** A pick wave and, on the detail read, its lines. Mirrors PickWaveResponseModel. */
export interface PickWave {
  id: number;
  waveNumber: string;
  status: PickWaveStatus;
  strategy: PickWaveStrategy;
  assignedToId: number | null;
  assignedToName: string | null;
  totalLines: number;
  pickedLines: number;
  releasedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  lines: PickLine[];
}
