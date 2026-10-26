import { VendorStatementLine } from './vendor-statement-line.model';
import { VendorStatementTotal } from './vendor-statement-total.model';

/** A vendor's open bills (positive) and open credits (negative), netted per currency. */
export interface VendorStatement {
  vendorId: number;
  vendorName: string;
  asOf: string;
  lines: VendorStatementLine[];
  totals: VendorStatementTotal[];
}
