import { toIsoDate } from '../../../shared/utils/date.utils';

export function hireDatePayload(value: Date | null, creating: boolean, changed: boolean): string | undefined {
  if (!creating && !changed) return undefined;
  return toIsoDate(value) ?? undefined;
}
