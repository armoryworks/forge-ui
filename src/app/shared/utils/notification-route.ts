export interface EntityRoute {
  path: (string | number)[];
  query?: Record<string, unknown>;
}

/** Desktop route for an entity a notification or scan points at; null when the entity has no page. */
export function resolveEntityRoute(entityType: string, entityId: number): EntityRoute | null {
  switch (entityType.toLowerCase()) {
    case 'job': return { path: ['/board'], query: { job: entityId } };
    case 'quote': return { path: ['/quotes'], query: { id: entityId } };
    case 'salesorder': return { path: ['/sales-orders'], query: { id: entityId } };
    case 'purchaseorder': return { path: ['/purchase-orders'], query: { detail: `purchase-order:${entityId}` } };
    case 'invoice': return { path: ['/invoices'], query: { id: entityId } };
    case 'expense': return { path: ['/expenses'], query: { id: entityId } };
    case 'lead': return { path: ['/leads'], query: { id: entityId } };
    case 'part': return { path: ['/parts'], query: { id: entityId } };
    case 'shipment': return { path: ['/shipments'], query: { id: entityId } };
    case 'customer': return { path: ['/customers', entityId, 'overview'] };
    case 'asset': return { path: ['/assets'], query: { id: entityId } };
    case 'vendor': return { path: ['/vendors'], query: { id: entityId } };
    case 'timeentry': return { path: ['/time-tracking'], query: { id: entityId } };
    case 'training': return { path: ['/training'] };
    case 'users': return { path: ['/admin/users'] };
    case 'compliance_submissions': return { path: ['/account/tax-forms'] };
    case 'reorder_suggestions': return { path: ['/inventory/replenishment'] };
    case 'customerreturn': return { path: ['/customer-returns'], query: { id: entityId } };
    case 'payment': return { path: ['/payments'], query: { id: entityId } };
    default: return null;
  }
}
