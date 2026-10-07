export interface ClonePartRequest {
  name: string;
  partNumber?: string;
  description?: string;
  copyBom: boolean;
  copyRouting: boolean;
  copyVendorSources: boolean;
}
