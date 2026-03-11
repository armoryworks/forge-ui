export type ScanContext =
  | 'global'
  | 'parts'
  | 'inventory'
  | 'shop-floor'
  | 'kanban'
  | 'receiving'
  | 'shipping'
  | 'quality';

export interface ScanEvent {
  value: string;
  timestamp: Date;
  context: ScanContext;
}
