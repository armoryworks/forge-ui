const STATUS_CHIPS: Record<string, string> = {
  Draft: 'chip--muted',
  Frozen: 'chip--info',
  Counting: 'chip--warning',
  Review: 'chip--warning',
  Posted: 'chip--success',
  Cancelled: 'chip--muted',
  Open: 'chip--muted',
  Counted: 'chip--success',
  RecountRequired: 'chip--error',
  Recounted: 'chip--success',
  Void: 'chip--muted',
};

export function physicalInventoryStatusChip(status: string): string {
  return `chip ${STATUS_CHIPS[status] ?? ''}`.trim();
}
