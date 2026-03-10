export interface SalesTaxRate {
  id: number;
  name: string;
  code: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
}
