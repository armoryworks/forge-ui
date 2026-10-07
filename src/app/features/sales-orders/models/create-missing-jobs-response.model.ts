import { CreateMissingJobsSkippedLine } from './create-missing-jobs-skipped-line.model';

export interface CreateMissingJobsResponse {
  created: number;
  skipped: CreateMissingJobsSkippedLine[];
}
