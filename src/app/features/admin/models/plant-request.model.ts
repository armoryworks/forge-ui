export interface PlantRequest {
  code: string;
  name: string;
  companyLocationId: number;
  timeZone: string | null;
  currencyCode: string | null;
  isActive: boolean;
  isDefault: boolean;
}
