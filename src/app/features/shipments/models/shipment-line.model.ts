export interface ShipmentLine {
  id: number;
  salesOrderLineId: number;
  description: string;
  quantity: number;
  notes: string | null;
}
