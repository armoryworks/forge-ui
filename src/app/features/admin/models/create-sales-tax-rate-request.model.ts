export interface CreateSalesTaxRateRequest {
  name: string;
  code: string;
  stateCode: string | null;
  rate: number;
  effectiveFrom: string | null;
  isDefault: boolean;
  description: string | null;
}
