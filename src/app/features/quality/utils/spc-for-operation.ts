import { SpcCharacteristic } from '../models/spc.model';

/** The characteristics measured at a routing step: the step's own and the part-wide ones (no step set). */
export function spcForOperation(characteristics: readonly SpcCharacteristic[], operationId: number | null): SpcCharacteristic[] {
  if (operationId == null) return [];
  return characteristics.filter(c => c.isActive && (c.operationId == null || c.operationId === operationId));
}
