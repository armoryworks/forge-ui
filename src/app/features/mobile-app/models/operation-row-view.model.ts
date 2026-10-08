import { JobOperationOpenTimer } from '../../../shared/models/job-operation-open-timer.model';
import { JobOperationRow } from '../../../shared/models/job-operation-row.model';

export interface OperationRowView {
  key: string;
  row: JobOperationRow;
  label: string;
  mine: JobOperationOpenTimer | null;
  others: string[];
  elapsed: string | null;
  done: boolean;
  actionable: boolean;
}
