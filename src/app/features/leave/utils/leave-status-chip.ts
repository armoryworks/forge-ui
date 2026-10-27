import { LeaveRequestStatus } from '../models/leave-request-status.type';

export function leaveStatusChip(status: LeaveRequestStatus): string {
  switch (status) {
    case 'Approved': return 'chip--success';
    case 'Denied': return 'chip--error';
    case 'Cancelled': return 'chip--muted';
    default: return 'chip--warning';
  }
}
