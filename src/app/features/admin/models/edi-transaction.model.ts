import { EdiDirection } from './edi-direction.model';
import { EdiTransactionStatus } from './edi-transaction-status.model';

export interface EdiTransaction {
  id: number;
  tradingPartnerId: number;
  tradingPartnerName: string;
  direction: EdiDirection;
  transactionSet: string;
  controlNumber: string | null;
  status: EdiTransactionStatus;
  relatedEntityType: string | null;
  relatedEntityId: number | null;
  receivedAt: string | null;
  processedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  isAcknowledged: boolean;
  payloadSizeBytes: number | null;
}
