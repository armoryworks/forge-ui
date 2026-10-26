/** One part's on-hand valuation — mirrors `InventoryValuationModel` (`GET accounting/inventory-valuation`). */
export interface InventoryValuationRow {
  partId: number;
  partNumber: string;
  onHandQuantity: number;
  averageUnitCost: number;
  totalValue: number;
}

/** One inventory control account: the store's value against the GL balance. */
export interface InventoryReconciliationAccountLine {
  accountNumber: string;
  accountName: string;
  storeValue: number;
  glBalance: number;
  variance: number;
}

/** One reason the store and the GL differ. */
export interface InventoryReconcilingItem {
  kind: string;
  accountNumber: string | null;
  sourceType: string | null;
  amount: number;
  description: string;
}

/** The valuation store vs the GL inventory control balance — mirrors `InventoryValuationReconciliation`. */
export interface InventoryValuationReconciliation {
  bookId: number;
  storeValue: number;
  glInventoryBalance: number;
  glWorkInProcessBalance: number;
  glStockedBalance: number;
  variance: number;
  isReconciled: boolean;
  roundingTolerance: number;
  accounts: InventoryReconciliationAccountLine[];
  reconcilingItems: InventoryReconcilingItem[];
}
