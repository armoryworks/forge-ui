export interface VendorReturnLine {
  id: number;
  lineNumber: number;
  partId: number;
  partNumber: string | null;
  partDescription: string | null;
  lotNumber: string | null;
  locationId: number | null;
  locationName: string | null;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  shippedCost: number | null;
}
