export interface RfqListItem {
  id: number;
  rfqNumber: string;
  partId: number;
  partNumber: string;
  partDescription: string;
  quantity: number;
  requiredDate: string;
  status: string;
  description: string | null;
  specialInstructions: string | null;
  responseDeadline: string | null;
  sentAt: string | null;
  awardedAt: string | null;
  awardedVendorResponseId: number | null;
  generatedPurchaseOrderId: number | null;
  notes: string | null;
  vendorResponseCount: number;
  receivedResponseCount: number;
  createdAt: string;
}

export interface RfqDetail extends RfqListItem {
  vendorResponses: RfqVendorResponse[];
}

export interface RfqVendorResponse {
  id: number;
  rfqId: number;
  vendorId: number;
  vendorName: string;
  responseStatus: string;
  unitPrice: number | null;
  leadTimeDays: number | null;
  minimumOrderQuantity: number | null;
  toolingCost: number | null;
  quoteValidUntil: string | null;
  notes: string | null;
  invitedAt: string | null;
  respondedAt: string | null;
  isAwarded: boolean;
  declineReason: string | null;
}

export interface CreateRfqRequest {
  partId: number;
  quantity: number;
  requiredDate: string;
  description?: string;
  specialInstructions?: string;
  responseDeadline?: string;
}

export interface RecordVendorResponseRequest {
  vendorId: number;
  unitPrice?: number;
  leadTimeDays?: number;
  minimumOrderQuantity?: number;
  toolingCost?: number;
  quoteValidUntil?: string;
  notes?: string;
}

export interface SendRfqToVendorsRequest {
  vendorIds: number[];
}
