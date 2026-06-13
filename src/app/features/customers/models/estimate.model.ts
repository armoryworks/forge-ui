export type EstimateStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired' | 'ConvertedToQuote';

export interface Estimate {
  id: number;
  customerId: number;
  customerName: string;
  title: string;
  estimatedAmount: number;
  status: EstimateStatus;
  validUntil?: string;
  generatedQuoteId?: number;
  assignedToName?: string;
  createdAt: string;
}

/**
 * A single estimate line. Either a catalog part (partId set) or a lump-sum /
 * ad-hoc line for an unknown (partId null, free-text description + amount).
 * Shape mirrors the API's QuoteLineResponseModel (estimates are Quote rows).
 */
export interface EstimateLine {
  id: number;
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineNumber: number;
  notes: string | null;
}

export interface EstimateDetail extends Estimate {
  description?: string;
  notes?: string;
  assignedToId?: number;
  convertedAt?: string;
  updatedAt: string;
  lines: EstimateLine[];
}

/** Payload to add a line to an estimate (partId omitted = lump-sum / unknown). */
export interface EstimateLineInput {
  partId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}
