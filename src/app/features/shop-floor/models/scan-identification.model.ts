export interface ScanIdentification {
  scanType: 'employee' | 'job' | 'part' | 'sales-order' | 'purchase-order' | 'asset' | 'storage-location' | 'lot' | 'unknown';
  entityId?: number;
  entityNumber?: string;
  entityTitle?: string;
  stageName?: string;
  stageColor?: string;
  isClosed?: boolean;
}
