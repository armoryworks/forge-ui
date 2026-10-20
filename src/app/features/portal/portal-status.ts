export type PortalStatusEntity = 'order' | 'quote' | 'invoice' | 'shipment';

interface PortalStatusView {
  labelKey: string;
  chip: string;
}

const STATUS_VIEWS: Record<PortalStatusEntity, Record<string, PortalStatusView>> = {
  order: {
    Draft: { labelKey: 'salesOrders.statusDraft', chip: 'chip chip--muted' },
    Confirmed: { labelKey: 'salesOrders.statusConfirmed', chip: 'chip chip--info' },
    InProduction: { labelKey: 'salesOrders.statusInProduction', chip: 'chip chip--info' },
    PartiallyShipped: { labelKey: 'salesOrders.statusPartiallyShipped', chip: 'chip chip--warning' },
    Shipped: { labelKey: 'salesOrders.statusShipped', chip: 'chip chip--warning' },
    Completed: { labelKey: 'salesOrders.statusCompleted', chip: 'chip chip--success' },
    Cancelled: { labelKey: 'salesOrders.statusCancelled', chip: 'chip chip--muted' },
  },
  quote: {
    Draft: { labelKey: 'quotes.statusDraft', chip: 'chip chip--muted' },
    Sent: { labelKey: 'quotes.statusSent', chip: 'chip chip--info' },
    Accepted: { labelKey: 'quotes.statusAccepted', chip: 'chip chip--success' },
    Declined: { labelKey: 'quotes.statusDeclined', chip: 'chip chip--error' },
    Expired: { labelKey: 'quotes.statusExpired', chip: 'chip chip--muted' },
    ConvertedToQuote: { labelKey: 'portal.quotes.statusConvertedToQuote', chip: 'chip chip--warning' },
    ConvertedToOrder: { labelKey: 'quotes.statusConvertedToOrder', chip: 'chip chip--success' },
    Superseded: { labelKey: 'quotes.statusSuperseded', chip: 'chip chip--muted' },
  },
  invoice: {
    Draft: { labelKey: 'invoices.statusDraft', chip: 'chip chip--muted' },
    Sent: { labelKey: 'invoices.statusSent', chip: 'chip chip--info' },
    PartiallyPaid: { labelKey: 'invoices.statusPartiallyPaid', chip: 'chip chip--warning' },
    Paid: { labelKey: 'invoices.statusPaid', chip: 'chip chip--success' },
    Overdue: { labelKey: 'invoices.statusOverdue', chip: 'chip chip--error' },
    Voided: { labelKey: 'invoices.statusVoided', chip: 'chip chip--muted' },
  },
  shipment: {
    Pending: { labelKey: 'shipments.statusPending', chip: 'chip chip--muted' },
    Packed: { labelKey: 'shipments.statusPacked', chip: 'chip chip--muted' },
    Shipped: { labelKey: 'shipments.statusShipped', chip: 'chip chip--info' },
    InTransit: { labelKey: 'shipments.statusInTransit', chip: 'chip chip--info' },
    Delivered: { labelKey: 'shipments.statusDelivered', chip: 'chip chip--success' },
    Cancelled: { labelKey: 'shipments.statusCancelled', chip: 'chip chip--muted' },
  },
};

const QUOTE_TYPE_KEYS: Record<string, string> = {
  Estimate: 'portal.quotes.typeEstimate',
  Quote: 'portal.quotes.typeQuote',
};

export function portalStatusLabelKey(entity: PortalStatusEntity, status: string): string {
  return STATUS_VIEWS[entity][status]?.labelKey ?? status;
}

export function portalStatusChip(entity: PortalStatusEntity, status: string): string {
  return STATUS_VIEWS[entity][status]?.chip ?? 'chip';
}

export function portalQuoteTypeLabelKey(quoteType: string): string {
  return QUOTE_TYPE_KEYS[quoteType] ?? quoteType;
}
