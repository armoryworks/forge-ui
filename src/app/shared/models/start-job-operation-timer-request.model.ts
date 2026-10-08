import { JobOperationEntryType } from './job-operation-entry-type.type';

export interface StartJobOperationTimerRequest {
  entryType?: JobOperationEntryType;
}
