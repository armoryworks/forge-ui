/** Chip modifier per pick wave and pick line status, for the status chips on the pick screens. */
export const PICK_STATUS_CHIP: Readonly<Record<string, string>> = {
  Draft: 'chip--muted',
  Released: 'chip--info',
  InProgress: 'chip--warning',
  Completed: 'chip--success',
  Cancelled: 'chip--error',
  Pending: 'chip--muted',
  Picked: 'chip--success',
  Short: 'chip--warning',
  Skipped: 'chip--error',
};
