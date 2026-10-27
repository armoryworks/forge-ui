import { ConsignmentTransaction } from './consignment-transaction.model';

export interface ConsignmentReconciliation {
  agreementId: number;
  bookQuantity: number;
  physicalQuantity: number;
  variance: number;
  adjustmentTransactionId: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  consumedTransactions: ConsignmentTransaction[];
  consumedQuantity: number;
  consumedAmount: number;
  vendorBillId: number | null;
  vendorBillNumber: string | null;
  billingAvailable: boolean;
}
