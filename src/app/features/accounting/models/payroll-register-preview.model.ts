import { PayrollRegisterPreviewRow } from './payroll-register-preview-row.model';

/** Dry run of a payroll register import — mirrors `PayrollRegisterPreviewModel`. */
export interface PayrollRegisterPreview {
  columns: Record<string, string[]>;
  rows: PayrollRegisterPreviewRow[];
  grossWages: number;
  employeeTaxWithheld: number;
  employerTax: number;
  netPay: number;
  errors: string[];
}
