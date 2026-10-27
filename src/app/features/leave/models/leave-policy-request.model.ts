export interface LeavePolicyRequest {
  name: string;
  accrualRatePerPayPeriod: number;
  maxBalance: number | null;
  carryOverLimit: number | null;
  accrueFromHireDate: boolean;
  waitingPeriodDays: number | null;
  isPaidLeave: boolean;
  isActive?: boolean;
}
