export interface MobileReceiptLine {
  lineId: number;
  quantity: number;
  storageLocationId: number | null;
  lotNumber: string | null;
}
