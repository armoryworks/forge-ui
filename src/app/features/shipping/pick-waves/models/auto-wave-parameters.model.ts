import { PickWaveStrategy } from './pick-wave-strategy.model';

/** Body for POST /pick-waves/auto-generate. Mirrors AutoWaveParametersModel. */
export interface AutoWaveParameters {
  strategy: PickWaveStrategy;
  shipByDateFrom?: string | null;
  shipByDateTo?: string | null;
  maxLinesPerWave: number;
  assignedToId?: number | null;
}
