import { JobDisposition } from './job-disposition.type';

export interface DisposeJobRequest {
  disposition: JobDisposition;
  notes?: string;
}
