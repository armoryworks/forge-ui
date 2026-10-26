/** Outcome of a payroll register import (a Draft pay run) — mirrors `PayrollRegisterImportResultModel`. */
export interface PayrollRegisterImportResult {
  payRunId: number;
  employeeCount: number;
  grossWages: number;
  employeeTaxWithheld: number;
  employerTax: number;
  netPay: number;
  warnings: string[];
}
