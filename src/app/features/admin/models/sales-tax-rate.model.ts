export interface SalesTaxRate {
  id: number;
  name: string;
  code: string;
  stateCode: string | null;
  rate: number;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  isDefault: boolean;
  isActive: boolean;
  description: string | null;
}
