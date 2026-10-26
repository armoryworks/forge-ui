const STATUS_CHIPS: Record<string, string> = {
  Draft: 'chip--muted',
  Issued: 'chip--info',
  PartiallyApplied: 'chip--warning',
  Applied: 'chip--success',
  Refunded: 'chip--success',
  Voided: 'chip--muted',
};

export function creditMemoStatusChip(status: string): string {
  return `chip ${STATUS_CHIPS[status] ?? ''}`.trim();
}
