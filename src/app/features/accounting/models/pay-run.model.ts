/** A pay run with its derived net pay and posted journal link — mirrors `PayRunModel`. */
export interface PayRun {
  id: number;
  bookId: number;
  payDate: string;
  periodStart: string;
  periodEnd: string;
  grossWages: number;
  employeeTaxWithheld: number;
  employerTax: number;
  netPay: number;
  status: 'Draft' | 'Posted';
  journalEntryId: number | null;
  journalEntryNumber: number | null;
}
