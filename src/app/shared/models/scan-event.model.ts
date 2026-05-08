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
  | 'leads';

export interface ScanEvent {
  value: string;
  timestamp: Date;
  context: ScanContext;
}
