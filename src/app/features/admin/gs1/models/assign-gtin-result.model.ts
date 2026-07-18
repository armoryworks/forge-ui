/**
 * Result of assigning a GTIN to a part. `source` is "Manual" when a purchased
 * GTIN was supplied, or "Allocated" when one was auto-generated from the
 * company prefix.
 */
export interface AssignGtinResult {
  partId: number;
  gtin: string;
  source: 'Manual' | 'Allocated';
}
