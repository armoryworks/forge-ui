import { LeaveAdjustmentType } from './leave-adjustment-type.type';

export interface LeaveBalanceAdjustment {
  id: number;
  userId: number;
  policyId: number;
  policyName: string;
  type: LeaveAdjustmentType;
  hours: number;
  effectiveDate: string;
  reason: string | null;
  balanceAfter: number;
  createdByUserId: number | null;
  createdByName: string | null;
  createdAt: string;
}
