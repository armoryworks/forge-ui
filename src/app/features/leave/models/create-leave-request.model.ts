export interface CreateLeaveRequest {
  policyId: number;
  startDate: string;
  endDate: string;
  hours: number;
  reason?: string | null;
}
