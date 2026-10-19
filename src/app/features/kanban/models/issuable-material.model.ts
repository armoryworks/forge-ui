export interface IssuableMaterial {
  partId: number;
  partNumber: string;
  description: string | null;
  perUnit: number;
  requiredQuantity: number;
  issuedQuantity: number;
  alternateForPartId: number | null;
  alternateForPartNumber: string | null;
}
