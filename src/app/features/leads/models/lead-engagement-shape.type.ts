/**
 * Wave 7 — engagement-shape classification axis on Lead. Mirrors the
 * server's LeadEngagementShape enum. Drives the New Lead fork dialog
 * + per-shape specialised intake fields.
 */
export type LeadEngagementShape =
  | 'Unknown'
  | 'QuickQuote'
  | 'Repeat'
  | 'Strategic'
  | 'Prototype';
