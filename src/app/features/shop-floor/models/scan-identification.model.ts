export interface ScanIdentification {
  scanType: 'employee' | 'job' | 'job-operation' | 'part' | 'sales-order' | 'purchase-order' | 'asset' | 'storage-location' | 'lot' | 'unknown';
  entityId?: number;
  entityNumber?: string;
  entityTitle?: string;
  stageName?: string;
  stageColor?: string;
  isClosed?: boolean;
  operationId?: number | null;
  stepNumber?: number | null;
}
