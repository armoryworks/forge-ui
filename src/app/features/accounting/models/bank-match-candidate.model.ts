/** A Posted cash journal line a statement line can be matched to by hand — mirrors `BankStatementMatchCandidateModel`. */
export interface BankMatchCandidate {
  journalLineId: number;
  journalEntryId: number;
  entryNumber: number;
  entryDate: string;
  amount: number;
  memo: string | null;
  description: string | null;
  source: string;
  sourceType: string | null;
  daysApart: number;
  amountDifference: number;
}
