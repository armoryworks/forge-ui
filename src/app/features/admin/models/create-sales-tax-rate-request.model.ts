export interface CreateSalesTaxRateRequest {
  name: string;
  code: string;
  rate: number;
  isDefault: boolean;
  description: string | null;
}
