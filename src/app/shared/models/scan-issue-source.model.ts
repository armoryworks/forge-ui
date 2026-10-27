export interface ScanIssueSource {
  binContentId: number;
  locationId: number;
  locationPath: string;
  locationBarcode: string | null;
  lotNumber: string | null;
  expirationDate: string | null;
  availableQuantity: number;
}
