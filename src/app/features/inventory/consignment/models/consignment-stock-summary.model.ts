import { ConsignmentAgreementStock } from './consignment-agreement-stock.model';

export interface ConsignmentStockSummary {
  totalAgreements: number;
  activeAgreements: number;
  totalConsignedValue: number;
  totalUnbilledValue: number;
  agreements: ConsignmentAgreementStock[];
}
