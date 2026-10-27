/** One line the pay-run post will write, with its resolved account (null when unmapped). */
export interface PayRunJournalLine {
  accountKey: string;
  glAccountId: number | null;
  accountNumber: string | null;
  accountName: string | null;
  debit: number;
  credit: number;
  description: string | null;
}
