import { BinStock } from './bin-stock.model';

export interface InventoryPartSummary {
  partId: number;
  partNumber: string;
  description: string;
  onHand: number;
  reserved: number;
  available: number;
  binLocations: BinStock[];
}
