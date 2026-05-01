export interface PartSearchResult {
  id: number;
  partNumber: string;
  description: string;
  revision: string;
  status: string;
  procurementSource: string;
  inventoryClass: string;
  bomEntryCount: number;
  createdAt: Date;
}
