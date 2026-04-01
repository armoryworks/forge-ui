export type EstimateStatus = 'Draft' | 'Sent' | 'Accepted' | 'Declined' | 'Expired';

export interface Estimate {
  id: number;
  customerId: number;
  customerName: string;
  title: string;
  estimatedAmount: number;
  status: EstimateStatus;
  validUntil?: string;
  convertedToQuoteId?: number;
  assignedToName?: string;
  createdAt: string;
}

export interface EstimateDetail extends Estimate {
  description?: string;
  notes?: string;
  assignedToId?: number;
  convertedAt?: string;
  updatedAt: string;
}
