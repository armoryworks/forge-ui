import { ConsignmentAgreementStatus } from './consignment-agreement-status.type';

export interface ConsignmentAgreement {
  id: number;
  direction: 'Inbound' | 'Outbound';
  vendorId: number | null;
  vendorName: string | null;
  customerId: number | null;
  customerName: string | null;
  partId: number;
  partNumber: string;
  partDescription: string;
  agreedUnitPrice: number;
  minStockQuantity: number | null;
  maxStockQuantity: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  invoiceOnConsumption: boolean;
  status: ConsignmentAgreementStatus;
  terms: string | null;
  reconciliationFrequencyDays: number;
  transactionCount: number;
  createdAt: string;
}
