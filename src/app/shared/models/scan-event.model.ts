export type ScanContext =
  | 'global'
  | 'parts'
  | 'inventory'
  | 'shop-floor'
  | 'kanban'
  | 'receiving'
  | 'shipping'
  | 'quality'
  | 'customers'
  | 'leads'
  | 'kiosk-inspect';

export interface ScanEvent {
  value: string;
  timestamp: Date;
  context: ScanContext;
}
