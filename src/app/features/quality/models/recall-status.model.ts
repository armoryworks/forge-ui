export type RecallStatus = 'Active' | 'Resolved' | 'Withdrawn';

export const RECALL_STATUS_LABEL_KEYS: Record<RecallStatus, string> = {
  Active: 'recalls.statusActive',
  Resolved: 'recalls.statusResolved',
  Withdrawn: 'recalls.statusWithdrawn',
};

export const RECALL_STATUS_CHIP_CLASSES: Record<RecallStatus, string> = {
  Active: 'chip--error',
  Resolved: 'chip--success',
  Withdrawn: 'chip--muted',
};
