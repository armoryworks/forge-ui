import { FinalPayLeaveLine } from './final-pay-leave-line.model';

export interface FinalPaySummary {
  employeeProfileId: number;
  terminationDate?: string | null;
  finalPayRequired: boolean;
  finalPayProcessedAt?: string | null;
  periodStart: string;
  periodEnd: string;
  hoursSinceLastPeriod: number;
  ptoPayoutHours: number;
  hourlyRate?: number | null;
  ptoPayoutAmount?: number | null;
  leaveLines: FinalPayLeaveLine[];
}
