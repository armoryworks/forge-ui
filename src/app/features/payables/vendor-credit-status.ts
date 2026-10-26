const STATUS_CHIPS: Record<string, string> = {
  Draft: 'chip--muted',
  Open: 'chip--info',
  PartiallyApplied: 'chip--warning',
  Applied: 'chip--success',
  Voided: 'chip--muted',
  Shipped: 'chip--primary',
  Credited: 'chip--success',
  Closed: 'chip--muted',
  Pending: 'chip--info',
  Running: 'chip--primary',
  Completed: 'chip--success',
  Interrupted: 'chip--error',
  Cancelled: 'chip--muted',
  Paid: 'chip--success',
  Failed: 'chip--error',
};

/** The chip class for a vendor credit memo, return to vendor, payment run or run item status. */
export function vendorCreditStatusChip(status: string): string {
  return `chip ${STATUS_CHIPS[status] ?? ''}`.trim();
}
