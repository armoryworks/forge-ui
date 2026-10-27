export interface LeaveBalance {
  id: number;
  userId: number;
  policyId: number;
  policyName: string;
  balance: number;
  usedThisYear: number;
  accruedThisYear: number;
  lastAccrualDate: string;
  userName?: string | null;
}
