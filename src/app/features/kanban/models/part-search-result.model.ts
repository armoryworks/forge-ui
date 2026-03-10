export interface PartSearchResult {
  id: number;
  partNumber: string;
  description: string;
  revision: string;
  status: string;
  partType: string;
  material: string | null;
  bomEntryCount: number;
  createdAt: string;
}
