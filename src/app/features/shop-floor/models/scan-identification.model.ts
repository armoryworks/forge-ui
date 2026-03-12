export interface ScanIdentification {
  scanType: 'employee' | 'job' | 'unknown';
  jobId?: number;
  jobNumber?: string;
  jobTitle?: string;
  stageName?: string;
  stageColor?: string;
}
