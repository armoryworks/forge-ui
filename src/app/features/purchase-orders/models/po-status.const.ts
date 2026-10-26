/**
 * Presentation maps for `PurchaseOrder.status`. Mirrors the server-side
 * `Forge.Core.Enums.PurchaseOrderStatus` values exactly. A PO waiting on its
 * approval workflow is `PendingApproval`: not yet sent to the vendor and not
 * receivable.
 */
export const PO_STATUSES = [
  'Draft',
  'PendingApproval',
  'Submitted',
  'Acknowledged',
  'PartiallyReceived',
  'Received',
  'Closed',
  'Cancelled',
] as const;

export const PO_STATUS_CHIP_CLASSES: Record<string, string> = {
  Draft: 'chip--muted',
  PendingApproval: 'chip--warning',
  Submitted: 'chip--info',
  Acknowledged: 'chip--primary',
  PartiallyReceived: 'chip--warning',
  Received: 'chip--success',
  Closed: 'chip--muted',
  Cancelled: 'chip--error',
};

export const PO_STATUS_LABEL_KEYS: Record<string, string> = {
  Draft: 'status.draft',
  PendingApproval: 'purchaseOrders.statusPendingApproval',
  Submitted: 'purchaseOrders.statusSubmitted',
  Acknowledged: 'purchaseOrders.statusAcknowledged',
  PartiallyReceived: 'purchaseOrders.statusPartiallyReceived',
  Received: 'purchaseOrders.statusReceived',
  Closed: 'status.closed',
  Cancelled: 'status.cancelled',
};
