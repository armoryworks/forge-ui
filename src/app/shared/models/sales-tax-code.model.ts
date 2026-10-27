/** A sales tax code as pickers need it (the full admin shape lives in the admin feature). */
export interface SalesTaxCode {
  id: number;
  name: string;
  code: string;
  rate: number;
  isActive: boolean;
}
