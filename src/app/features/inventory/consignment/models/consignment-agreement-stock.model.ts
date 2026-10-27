import { ConsignmentAgreementStatus } from './consignment-agreement-status.type';

export interface ConsignmentAgreementStock {
  agreementId: number;
  direction: 'Inbound' | 'Outbound';
  status: ConsignmentAgreementStatus;
  ownerName: string;
  partId: number;
  partNumber: string;
  agreedUnitPrice: number;
  onHandQuantity: number;
  onHandValue: number;
  unbilledQuantity: number;
  unbilledValue: number;
  minStockQuantity: number | null;
  maxStockQuantity: number | null;
  belowMinimum: boolean;
  aboveMaximum: boolean;
}
