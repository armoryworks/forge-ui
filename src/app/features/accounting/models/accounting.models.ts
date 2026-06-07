// DTOs for the dark GL accounting suite (CAP-ACCT-FULLGL / CAP-RPT-FINANCIALS). Shapes mirror the
// forge.api Forge.Core.Models.Accounting records (camelCase JSON; computed getters are serialized).

export interface StatementAccountLine {
  glAccountId: number;
  accountNumber: string;
  accountName: string;
  amount: number;
}

// ── Trial balance ──────────────────────────────────────────────────────────
export interface TrialBalanceRow {
  glAccountId: number;
  accountNumber: string;
  accountName: string;
  debitTotal: number;
  creditTotal: number;
  netBalance: number;
}

export interface TrialBalance {
  bookId: number;
  fromDate?: string | null;
  toDate?: string | null;
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

// ── Profit & Loss ──────────────────────────────────────────────────────────
export interface ProfitAndLoss {
  bookId: number;
  fromDate?: string | null;
  toDate?: string | null;
  income: StatementAccountLine[];
  expense: StatementAccountLine[];
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  cogsPosted: boolean;
  marginCaveat: string;
}

// ── Balance sheet ──────────────────────────────────────────────────────────
export interface BalanceSheet {
  bookId: number;
  asOfDate: string;
  assets: StatementAccountLine[];
  liabilities: StatementAccountLine[];
  equity: StatementAccountLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquityPosted: number;
  currentYearEarnings: number;
  totalEquityWithEarnings: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
  cogsPosted: boolean;
  marginCaveat: string;
}

// ── Cash flow (indirect) ───────────────────────────────────────────────────
export interface CashFlowStatement {
  bookId: number;
  fromDate?: string | null;
  toDate: string;
  netIncome: number;
  operatingAdjustments: StatementAccountLine[];
  netCashFromOperating: number;
  investing: StatementAccountLine[];
  netCashFromInvesting: number;
  financing: StatementAccountLine[];
  netCashFromFinancing: number;
  netChangeInCash: number;
  actualCashChange: number;
  roundingTolerance: number;
  isReconciled: boolean;
}

// ── AR / AP aging ──────────────────────────────────────────────────────────
export interface AgingBucket {
  fromDays: number;
  toDays: number | null;
  label: string;
  amount: number;
}

export interface AgingPartyRow {
  // AR rows carry customerId/customerName; AP rows vendorId/vendorName. Normalized for display.
  customerId?: number;
  customerName?: string;
  vendorId?: number;
  vendorName?: string;
  openBalance: number;
  buckets: AgingBucket[];
}

export interface AgingReconciliation {
  controlBalance: number;
  agingTotal: number;
  difference: number;
  isReconciled: boolean;
}

export interface ApAging {
  bookId: number;
  asOfDate: string;
  vendors: AgingPartyRow[];
  totalsByBucket: AgingBucket[];
  grandTotal: number;
  reconciliation: AgingReconciliation;
}

export interface ArAging {
  bookId: number;
  asOfDate: string;
  customers: AgingPartyRow[];
  totalsByBucket: AgingBucket[];
  grandTotal: number;
  reconciliation: AgingReconciliation;
}

// ── GRNI reconciliation ────────────────────────────────────────────────────
export interface GrniPoRow {
  purchaseOrderId: number;
  poNumber: string;
  vendorId: number;
  vendorName: string;
  openAmount: number;
  buckets: AgingBucket[];
}

export interface GrniUncoveredReceipt {
  receivingRecordId: number;
  purchaseOrderId: number;
  purchaseOrderLineId: number;
  receiptNumber?: string | null;
  quantityReceived: number;
  receivedDate: string;
  reason: string;
}

export interface GrniReconciliation {
  bookId: number;
  asOfDate: string;
  glBalance: number;
  operationalOpen: number;
  variance: number;
  roundingTolerance: number;
  isReconciled: boolean;
  purchaseOrders: GrniPoRow[];
  totalsByBucket: AgingBucket[];
  grandTotal: number;
  uncoveredReceipts: GrniUncoveredReceipt[];
  uncoveredTruncated: boolean;
}

// ── Period / year close ────────────────────────────────────────────────────
export type FiscalPeriodStatus = 'Open' | 'SoftClosed' | 'HardClosed';

export interface FiscalPeriodModel {
  id: number;
  fiscalYearId: number;
  periodNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
}

export type FiscalYearStatus = 'Open' | 'Closed';

export interface FiscalYearModel {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalYearStatus;
  periods: FiscalPeriodModel[];
}

export interface YearEndCloseResult {
  fiscalYearId: number;
  journalEntryId: number | null;
  netIncome: number;
  retainedEarningsAccountId: number;
  periodsHardClosed: number;
}

// ── Bank reconciliation ────────────────────────────────────────────────────
export type BankReconciliationStatus = 'Draft' | 'Finalized';

export interface CashAccountModel {
  glAccountId: number;
  accountNumber: string;
  name: string;
}

export interface BankReconciliationSummary {
  reconciliationId: number;
  cashGlAccountId: number;
  cashAccountName: string;
  statementDate: string;
  statementEndingBalance: number;
  status: BankReconciliationStatus;
  difference: number;
  isReconciled: boolean;
}

export interface BankReconciliationItemRow {
  itemId: number;
  journalLineId: number;
  journalEntryId: number;
  entryDate: string;
  description?: string | null;
  amount: number;
  isCleared: boolean;
}

export interface BankReconciliationWorksheet {
  reconciliationId: number;
  bookId: number;
  cashGlAccountId: number;
  statementDate: string;
  statementEndingBalance: number;
  status: BankReconciliationStatus;
  bookBalance: number;
  items: BankReconciliationItemRow[];
  clearedTotal: number;
  outstandingTotal: number;
  difference: number;
  roundingTolerance: number;
  isReconciled: boolean;
}
