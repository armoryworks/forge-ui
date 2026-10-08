import { SubcontractOperation } from './subcontract-operation.model';

export interface SubcontractSendOutDialogData {
  jobId: number;
  operation: SubcontractOperation;
  defaultQuantity: number;
}
