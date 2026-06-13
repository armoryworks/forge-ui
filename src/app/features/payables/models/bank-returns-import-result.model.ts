// ⚡ BANKING BOUNDARY — outcome of one bank ACH return/NOC file import (Phase C).
export interface BankReturnsImportResult {
  entries: number;
  paymentsReturned: number;
  prenotesRejected: number;
  nocs: number;
  unmatched: number;
  alreadyApplied: number;
}
