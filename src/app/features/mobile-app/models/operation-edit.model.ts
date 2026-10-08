import { JobOperationRow } from '../../../shared/models/job-operation-row.model';

export interface OperationEdit {
  row: JobOperationRow;
  finishing: boolean;
}
