// ⚡ ACCOUNTING BOUNDARY — links part of a vendor payment to a specific bill.
// settlementFxRate (txn→functional, default 1) realizes FX vs the bill's
// booking rate on multi-currency installs.
export interface CreateVendorPaymentApplicationRequest {
  vendorBillId: number;
  amount: number;
  settlementFxRate?: number;
}
