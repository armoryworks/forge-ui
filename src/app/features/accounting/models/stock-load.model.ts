/** Lifecycle of an opening stock load — mirrors `StockLoadStatus`. */
export type StockLoadStatus = 'Draft' | 'Posted' | 'Voided';

/** How a stock load reaches the ledger — mirrors `StockLoadGlMode`. */
export type StockLoadGlMode = 'OffsetEquity' | 'ValuationOnly';

/** One opening-stock row — mirrors `StockLoadLineModel`. */
export interface StockLoadLine {
  id: number;
  lineNumber: number;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  storageLocationId: number;
  locationName: string;
  lotNumber: string | null;
  expirationDate: string | null;
  quantity: number;
  unitCost: number;
  extendedValue: number;
}

/** An opening stock load with its lines — mirrors `StockLoadModel` (`GET accounting/conversion/stock-loads/{id}`). */
export interface StockLoad {
  id: number;
  loadNumber: string;
  bookId: number;
  asOfDate: string;
  status: StockLoadStatus;
  glMode: StockLoadGlMode;
  sourceFileName: string | null;
  notes: string | null;
  totalValue: number;
  journalEntryId: number | null;
  journalEntryNumber: number | null;
  postedAt: string | null;
  voidedAt: string | null;
  createdAt: string;
  version: number;
  lines: StockLoadLine[];
}

/** One stock load in the list — mirrors `StockLoadSummaryModel`. */
export interface StockLoadSummary {
  id: number;
  loadNumber: string;
  asOfDate: string;
  status: StockLoadStatus;
  glMode: StockLoadGlMode;
  lineCount: number;
  totalValue: number;
  journalEntryId: number | null;
  postedAt: string | null;
  createdAt: string;
}

/** One row sent back on an update that keeps the draft's lines — mirrors `StockLoadLineInput`. */
export interface StockLoadLineInput {
  partId: number;
  storageLocationId: number;
  lotNumber: string | null;
  expirationDate: string | null;
  quantity: number;
  unitCost: number;
}

/** Body of a stock-load create / update: the header plus the CSV template's text, or the lines to keep. */
export interface StockLoadInput {
  bookId?: number | null;
  asOfDate: string;
  glMode: StockLoadGlMode;
  notes: string | null;
  sourceFileName: string | null;
  csvContent: string | null;
  lines?: StockLoadLineInput[];
}
