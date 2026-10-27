export type FmeaStatus = 'Draft' | 'Active' | 'Closed' | 'Superseded';

export const FMEA_STATUSES: readonly FmeaStatus[] = ['Draft', 'Active', 'Closed', 'Superseded'];

export const FMEA_STATUS_CHIP: Record<FmeaStatus, string> = {
  Draft: 'chip--muted',
  Active: 'chip--primary',
  Closed: 'chip--success',
  Superseded: 'chip--muted',
};
