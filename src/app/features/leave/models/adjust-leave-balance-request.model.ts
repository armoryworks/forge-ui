import { LeaveAdjustmentType } from './leave-adjustment-type.type';

export interface AdjustLeaveBalanceRequest {
  policyId: number;
  type: LeaveAdjustmentType;
  hours: number;
  effectiveDate: string;
  reason?: string | null;
}
