export interface ScanIdentification {
  scanType: 'employee' | 'job' | 'part' | 'sales-order' | 'purchase-order' | 'asset' | 'storage-location' | 'unknown';
  entityId?: number;
  entityNumber?: string;
  entityTitle?: string;
  stageName?: string;
  stageColor?: string;
}
