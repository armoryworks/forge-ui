export interface PartSearchResult {
  id: number;
  partNumber: string;
  name: string;
  description: string | null;
  revision: string;
  status: string;
  procurementSource: string;
  inventoryClass: string;
  bomLineCount: number;
  createdAt: Date;
}
