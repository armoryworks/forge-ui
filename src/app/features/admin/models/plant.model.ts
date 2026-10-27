export interface Plant {
  id: number;
  code: string;
  name: string;
  companyLocationId: number;
  locationName: string;
  timeZone: string | null;
  currencyCode: string | null;
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
