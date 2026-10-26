/** One line of `POST accounting/opening-balances` — mirrors `OpeningBalanceLineModel`. */
export interface OpeningBalanceLine {
  accountDeterminationKey: string | null;
  glAccountId: number | null;
  debit: number;
  credit: number;
  partyType: 'Customer' | 'Vendor' | null;
  partyId: number | null;
  description: string | null;
  documentNumber?: string | null;
  documentDate?: string | null;
  dueDate?: string | null;
}
