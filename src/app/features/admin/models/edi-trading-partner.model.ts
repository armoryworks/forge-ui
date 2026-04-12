import { EdiFormat } from './edi-format.model';
import { EdiTransportMethod } from './edi-transport-method.model';

export interface EdiTradingPartner {
  id: number;
  name: string;
  customerId: number | null;
  customerName: string | null;
  vendorId: number | null;
  vendorName: string | null;
  qualifierId: string;
  qualifierValue: string;
  defaultFormat: EdiFormat;
  transportMethod: EdiTransportMethod;
  autoProcess: boolean;
  requireAcknowledgment: boolean;
  isActive: boolean;
  notes: string | null;
  transactionCount: number;
  lastTransactionAt: string | null;
  errorCount: number;
}
