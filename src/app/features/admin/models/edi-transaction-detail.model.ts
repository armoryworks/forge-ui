import { EdiTransaction } from './edi-transaction.model';

export interface EdiTransactionDetail extends EdiTransaction {
  groupControlNumber: string | null;
  transactionControlNumber: string | null;
  errorDetailJson: string | null;
  lastRetryAt: string | null;
  acknowledgmentTransactionId: number | null;
  rawPayload: string;
  parsedDataJson: string | null;
}
