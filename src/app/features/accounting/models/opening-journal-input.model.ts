/** One opening-journal row as the cutover CSV template carries it: the account by number, one side non-zero. */
export interface OpeningJournalLineInput {
  accountNumber: string;
  debit: number;
  credit: number;
  description: string | null;
}

/** Body of `POST accounting/conversion/opening-journal` — one balanced Source=Conversion entry. */
export interface OpeningJournalInput {
  bookId: number;
  asOfDate: string;
  currencyId: number;
  lines: OpeningJournalLineInput[];
}
