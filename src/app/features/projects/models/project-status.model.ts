export type ProjectStatus = 'Planning' | 'Active' | 'OnHold' | 'Complete' | 'Cancelled';

export const PROJECT_STATUSES: readonly ProjectStatus[] = ['Planning', 'Active', 'OnHold', 'Complete', 'Cancelled'];

export const PROJECT_STATUS_CHIP: Record<ProjectStatus, string> = {
  Planning: 'chip--muted',
  Active: 'chip--primary',
  OnHold: 'chip--warning',
  Complete: 'chip--success',
  Cancelled: 'chip--muted',
};
