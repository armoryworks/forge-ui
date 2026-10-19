// ⚡ ACCOUNTING BOUNDARY — a GL account a standalone bill line can debit directly.
export interface BillableGlAccount {
  id: number;
  accountNumber: string;
  name: string;
  accountType: string;
}
