/**
 * Read model for a single PartPrice history row. <code>effectiveTo</code> is
 * null on the most recent open row; closed rows are immutable history. The
 * resolver-current price renders separately on the part — this surface is
 * for the chronological history table and the "post a new effective price"
 * form on the part-pricing cluster.
 */
export interface PartPrice {
  id: number;
  partId: number;
  unitPrice: number;
  currency: string;
  effectiveFrom: string; // ISO timestamp
  effectiveTo: string | null;
  notes: string | null;
  createdAt: string; // ISO timestamp
}

/**
 * Request body for posting a new effective-dated PartPrice. The server
 * closes out any prior open row by setting its effectiveTo to this row's
 * effectiveFrom — keeps the history coherent with at most one open row at
 * a time.
 */
export interface AddPartPriceRequest {
  unitPrice: number;
  currency?: string; // ISO-4217 — defaults to install base on server when omitted
  effectiveFrom?: string; // ISO date — defaults to now on server if omitted
  notes?: string;
}
