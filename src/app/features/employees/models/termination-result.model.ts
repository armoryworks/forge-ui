import { TerminationEffects } from './termination-effects.model';

export interface TerminationResult {
  employeeProfileId: number;
  userId?: number | null;
  terminationDate: string;
  reasonCode: string;
  appliedAt?: string | null;
  effects?: TerminationEffects | null;
}
