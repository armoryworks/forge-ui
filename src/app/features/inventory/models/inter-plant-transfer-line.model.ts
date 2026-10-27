export interface InterPlantTransferLine {
  id: number;
  partId: number;
  partNumber: string;
  partDescription: string;
  quantity: number;
  receivedQuantity: number | null;
  lotNumber: string | null;
  fromLocationId: number | null;
  fromLocationPath: string | null;
  toLocationId: number | null;
  toLocationPath: string | null;
}
