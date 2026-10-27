export type PpapStatus = 'Draft' | 'InProgress' | 'Submitted' | 'Approved' | 'Rejected' | 'Interim';

export const PPAP_STATUSES: readonly PpapStatus[] = ['Draft', 'InProgress', 'Submitted', 'Approved', 'Rejected', 'Interim'];

export const PPAP_STATUS_CHIP: Record<PpapStatus, string> = {
  Draft: 'chip--muted',
  InProgress: 'chip--primary',
  Submitted: 'chip--info',
  Approved: 'chip--success',
  Rejected: 'chip--error',
  Interim: 'chip--warning',
};
