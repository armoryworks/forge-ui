import { ConsignmentAgreementStatus } from './consignment-agreement-status.type';

export interface SaveConsignmentAgreementRequest {
  direction?: 'Inbound';
  vendorId?: number;
  partId?: number;
  agreedUnitPrice: number;
  minStockQuantity: number | null;
  maxStockQuantity: number | null;
  effectiveFrom?: string;
  effectiveTo: string | null;
  invoiceOnConsumption: boolean;
  terms: string | null;
  reconciliationFrequencyDays: number;
  status?: ConsignmentAgreementStatus;
}
