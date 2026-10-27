/** One employee row of a register preview. */
export interface PayrollRegisterPreviewRow {
  employeeName: string;
  gross: number;
  withholdings: number;
  employerTax: number;
  reportedNet: number;
  computedNet: number;
  netMismatch: boolean;
}
