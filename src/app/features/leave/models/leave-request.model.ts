import { LeaveRequestStatus } from './leave-request-status.type';

export interface LeaveRequest {
  id: number;
  userId: number;
  userName: string;
  policyId: number;
  policyName: string;
  startDate: string;
  endDate: string;
  hours: number;
  status: LeaveRequestStatus;
  approvedById: number | null;
  approvedByName: string | null;
  decidedAt: string | null;
  reason: string | null;
  denialReason: string | null;
  createdAt: string;
}
