// DTOs for the dark GL accounting suite (CAP-ACCT-FULLGL / CAP-RPT-FINANCIALS). Shapes mirror the
// forge.api Forge.Core.Models.Accounting records (camelCase JSON; computed getters are serialized).

export interface StatementAccountLine {
  glAccountId: number;
  accountNumber: string;
  accountName: string;
  amount: number;
  /** Comparative-period fields — present only when the statement was requested with `compare=true`. */
  priorAmount?: number | null;
  variance?: number | null;
  /** Signed percentage movement vs prior; null when no comparison or prior is zero. */
  variancePercent?: number | null;
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
  // Comparative period (present only when compare=true).
  compareFromDate?: string | null;
  compareToDate?: string | null;
  hasComparison?: boolean;
  priorTotalIncome?: number | null;
  priorTotalExpense?: number | null;
  priorNetIncome?: number | null;
  totalIncomeVariance?: number | null;
  totalIncomeVariancePercent?: number | null;
  totalExpenseVariance?: number | null;
  totalExpenseVariancePercent?: number | null;
  netIncomeVariance?: number | null;
  netIncomeVariancePercent?: number | null;
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
  // Comparative period (present only when compare=true).
  compareAsOfDate?: string | null;
  hasComparison?: boolean;
  priorTotalAssets?: number | null;
  priorTotalLiabilities?: number | null;
  priorCurrentYearEarnings?: number | null;
  priorTotalEquityWithEarnings?: number | null;
  priorTotalLiabilitiesAndEquity?: number | null;
  totalAssetsVariance?: number | null;
  totalAssetsVariancePercent?: number | null;
  totalLiabilitiesVariance?: number | null;
  totalLiabilitiesVariancePercent?: number | null;
  currentYearEarningsVariance?: number | null;
  currentYearEarningsVariancePercent?: number | null;
  totalEquityWithEarningsVariance?: number | null;
  totalEquityWithEarningsVariancePercent?: number | null;
  totalLiabilitiesAndEquityVariance?: number | null;
  totalLiabilitiesAndEquityVariancePercent?: number | null;
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

/**
 * One jurisdiction row of the sales-tax liability report: the seller sales-tax
 * owed for orders shipping to a single US state. `jurisdiction` is null when the
 * order carries no ship-to state on record (the "unassigned" bucket).
 */
export interface SalesTaxLiabilityJurisdictionRow {
  jurisdiction: string | null;
  taxableBase: number;
  liability: number;
  orderCount: number;
}

/**
 * Sales-tax liability report — what the business owes a taxing authority,
 * grouped by jurisdiction over an optional date range. Amounts sum the seller's
 * own liability (marketplace-facilitator tax the platform remits is excluded).
 */
export interface SalesTaxLiabilityReport {
  fromDate: string | null;
  toDate: string | null;
  jurisdictions: SalesTaxLiabilityJurisdictionRow[];
  totalTaxableBase: number;
  totalLiability: number;
  totalOrderCount: number;
}

// ── 1099 report ─────────────────────────────────────────────────────────────
/**
 * One 1099-flagged vendor's line: total cash paid in the calendar year and
 * whether it reaches the IRS 1099-NEC reporting threshold ($600). `taxId` is the
 * full TIN; the UI masks all but the last four digits.
 */
export interface Form1099VendorRow {
  vendorId: number;
  vendorName: string;
  vendorNumber: string | null;
  taxId: string | null;
  totalPayments: number;
  meetsThreshold: boolean;
}

/**
 * 1099 report — every vendor flagged as a 1099 payee with its total cash paid in
 * the calendar year, for preparing Form 1099-NEC filings.
 */
export interface Form1099Report {
  year: number;
  threshold: number;
  vendors: Form1099VendorRow[];
  totalPayments: number;
  reportableVendorCount: number;
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

// ── BANK-001: bank statement import + auto-match staging ──────────────────
export type BankStatementMatchStatus = 'Unmatched' | 'Suggested' | 'Confirmed' | 'Ignored';

export interface BankStatementImportModel {
  id: number;
  cashGlAccountId: number;
  fileName: string;
  format: string;
  lineCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  suggestedCount: number;
  confirmedCount: number;
  ignoredCount: number;
  createdAt: string;
}

export interface BankStatementLineModel {
  id: number;
  postedDate: string;
  amount: number;
  description: string;
  matchStatus: BankStatementMatchStatus;
  matchedJournalLineId: number | null;
  matchedEntryNumber: number | null;
  matchedEntryDate: string | null;
  matchedMemo: string | null;
  confirmedAt: string | null;
}

export interface ImportBankStatementResultModel {
  importId: number;
  imported: number;
  duplicates: number;
  suggested: number;
}

// ── Ledger register (§5A) ──
export type JournalEntryStatus = 'Draft' | 'PendingApproval' | 'Approved' | 'Posted' | 'Reversed';
export type JournalSource =
  | 'Manual'
  | 'AR'
  | 'AP'
  | 'Inventory'
  | 'Payroll'
  | 'FX'
  | 'Depreciation'
  | 'Conversion'
  | 'System';

export interface LedgerRegisterLine {
  id: number;
  lineNumber: number;
  glAccountId: number;
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string | null;
  jobId: number | null;
  costCenterId: number | null;
}

export interface LedgerRegisterEntry {
  id: number;
  entryNumber: number;
  entryDate: string;
  source: JournalSource;
  sourceType: string | null;
  sourceId: number | null;
  status: JournalEntryStatus;
  memo: string | null;
  reversalOfEntryId: number | null;
  reversedByEntryId: number | null;
  postedAt: string | null;
  lines: LedgerRegisterLine[];
}

export interface LedgerRegisterPage {
  data: LedgerRegisterEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface LedgerRegisterFilter {
  fromDate?: string | null;
  toDate?: string | null;
  status?: JournalEntryStatus | null;
  glAccountId?: number | null;
  page?: number;
  pageSize?: number;
}

// ── Accounting-AI advisory (§5A) ──
export interface JournalEntryExplanation {
  entryId: number;
  explanation: string;
  aiAvailable: boolean;
  deterministicSummary: string;
}

// ── Chart of accounts + manual journal entry (§5A editor) ──
export interface GlAccount {
  id: number;
  accountNumber: string;
  name: string;
  accountType: string;
  normalBalance: string;
  isPostable: boolean;
  isControlAccount: boolean;
  requiresJob: boolean;
  requiresCostCenter: boolean;
}

export interface ManualJournalLineInput {
  glAccountId: number;
  debit: number;
  credit: number;
  description?: string | null;
  jobId?: number | null;
  costCenterId?: number | null;
}

export interface ManualJournalEntryInput {
  bookId: number;
  entryDate: string; // DateOnly on the wire: "YYYY-MM-DD"
  currencyId: number;
  memo?: string | null;
  allowSoftClosedOverride?: boolean;
  lines: ManualJournalLineInput[];
  approvedByUserId?: number | null;
}

export interface ManualJournalEntryResult {
  id: number;
  bookId: number;
  entryNumber: number;
  entryDate: string;
  status: string;
  memo: string | null;
}

// ── Anomaly scan (§5A advisory) ──
export interface GlAnomaly {
  entryId: number;
  entryNumber: number;
  entryDate: string;
  source: string;
  totalDebit: number;
  flags: string[];
}

export interface GlAnomalyFilter {
  fromDate?: string | null;
  toDate?: string | null;
  largeManualThreshold?: number;
}

// ── Reverse / correct (§5A) ──
export interface ReverseJournalEntryInput {
  reversalDate: string; // DateOnly on the wire: "YYYY-MM-DD"
  reason: string;
}

// ── Training system (§5A.4) ──
export interface TrainingSandboxState {
  seeded: boolean;
  bookId: number | null;
  entryCount: number;
}

export interface ScenarioValidatorDef {
  type: string;
}

export interface TrainingScenario {
  id: string;
  track: 'A' | 'B' | 'both';
  order: number;
  titleKey: string;
  briefKey: string;
  baitKey: string | null;
  hintKeys: string[];
  validators: ScenarioValidatorDef[];
  successKey: string;
}

export interface ValidatorResult {
  type: string;
  passed: boolean;
}

export interface ScenarioCheckResult {
  scenarioId: string;
  passed: boolean;
  validators: ValidatorResult[];
}

/** A chart-of-accounts row for the management screen — full editable surface + HasPostings lock flag. */
export interface GlAccountAdmin {
  id: number;
  accountNumber: string;
  name: string;
  accountType: string;
  normalBalance: string;
  parentAccountId: number | null;
  isPostable: boolean;
  isControlAccount: boolean;
  isActive: boolean;
  requiresJob: boolean;
  requiresCostCenter: boolean;
  cashFlowCategory: string | null;
  description: string | null;
  hasPostings: boolean;
}

/** Create payload for a new GL account. */
export interface CreateGlAccountRequest {
  bookId: number;
  accountNumber: string;
  name: string;
  accountType: string;
  normalBalance: string;
  parentAccountId: number | null;
  requiresJob: boolean;
  requiresCostCenter: boolean;
  cashFlowCategory: string | null;
  description: string | null;
}

/** Update payload — structural fields (accountNumber/accountType/normalBalance) applied only when unposted. */
export interface UpdateGlAccountRequest {
  id: number;
  name: string;
  parentAccountId: number | null;
  requiresJob: boolean;
  requiresCostCenter: boolean;
  cashFlowCategory: string | null;
  description: string | null;
  isActive: boolean;
  accountNumber: string | null;
  accountType: string | null;
  normalBalance: string | null;
}

// ── Budgets + budget-vs-actual ───────────────────────────────────────────────
/** One stored budget line for a GL account in a fiscal year (full-year when `periodMonth` is null). */
export interface BudgetLine {
  id: number;
  bookId: number;
  glAccountId: number;
  accountNumber: string;
  accountName: string;
  fiscalYear: number;
  periodMonth?: number | null;
  amount: number;
}

/** Create-or-update payload for a budget line (upsert by book/account/year/month). */
export interface UpsertBudgetRequest {
  bookId: number;
  glAccountId: number;
  fiscalYear: number;
  periodMonth?: number | null;
  amount: number;
}

/** One GL account's budget-vs-actual comparison. Variance = actual − budget; percent null when budget is zero. */
export interface BudgetVsActualLine {
  glAccountId: number;
  accountNumber: string;
  accountName: string;
  budgetAmount: number;
  actualAmount: number;
  variance?: number | null;
  variancePercent?: number | null;
}

/** Budget-vs-actual P&L comparison for a book over a fiscal year (or a single month). */
export interface BudgetVsActual {
  bookId: number;
  fiscalYear: number;
  periodMonth?: number | null;
  fromDate: string;
  toDate: string;
  lines: BudgetVsActualLine[];
  totalBudget: number;
  totalActual: number;
  totalVariance?: number | null;
  totalVariancePercent?: number | null;
}
