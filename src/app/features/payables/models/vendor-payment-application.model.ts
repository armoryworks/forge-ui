// ⚡ ACCOUNTING BOUNDARY — one bill application of a VendorPaymentDetail:
// which bill the payment settled, for how much, and at what settlement FX
// rate (1 in single-currency installs).
export interface VendorPaymentApplication {
  vendorBillId: number;
  billNumber: string;
  amount: number;
  settlementFxRate: number;
}
