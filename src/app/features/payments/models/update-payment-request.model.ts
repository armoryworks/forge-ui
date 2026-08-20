export interface UpdatePaymentRequest {
  method: string;
  amount: number;
  paymentDate: string;
  referenceNumber?: string;
  notes?: string;
  /**
   * Optional manual override for the payment number. The server accepts it only
   * while the payment has no applications and manual numbers are enabled.
   */
  paymentNumber?: string;
}
