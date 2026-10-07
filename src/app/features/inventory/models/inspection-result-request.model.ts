import { InspectionResult } from './inspection-result.type';

export interface InspectionResultRequest {
  result: InspectionResult;
  acceptedQuantity: number;
  rejectedQuantity: number;
  notes?: string;
  createNcrOnReject: boolean;
  qcInspectionId?: number;
}
