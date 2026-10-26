/** One dry-run finding — mirrors `StockLoadIssue`. `lineNumber` is 0 for a load-level finding. */
export interface StockLoadIssue {
  lineNumber: number;
  code: string;
  severity: 'Error' | 'Warning';
  message: string;
}

/** The value a load puts on one inventory account — mirrors `StockLoadAccountTotal`. */
export interface StockLoadAccountTotal {
  glAccountId: number | null;
  accountNumber: string | null;
  accountName: string | null;
  total: number;
}

/** The stock-load dry run — mirrors `StockLoadValidationResult`. */
export interface StockLoadValidationResult {
  isValid: boolean;
  issues: StockLoadIssue[];
  accountTotals: StockLoadAccountTotal[];
  grandTotal: number;
}

/** The opening-stock screen's starting point — mirrors `StockLoadContextModel`. */
export interface StockLoadContext {
  bookId: number;
  bookName: string;
  openingJournalDate: string | null;
  openingJournalInventory: StockLoadAccountTotal[];
  connectedMode: boolean;
}
