// ⚡ BANKING BOUNDARY — an ACH payment awaiting batch assembly. bankAccountId null =
// the vendor has no payable (verified) bank account yet.
export interface BatchEligiblePayment {
  vendorPaymentId: number;
  paymentNumber: string;
  vendorId: number;
  vendorName: string;
  amount: number;
  paymentDate: string;
  bankAccountId: number | null;
  bankAccountStatus: string | null;
  accountNumberMasked: string | null;
}
