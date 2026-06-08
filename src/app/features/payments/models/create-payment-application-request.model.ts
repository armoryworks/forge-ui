export interface CreatePaymentApplicationRequest {
  invoiceId: number;
  amount: number;
  /**
   * Settlement FX rate (cash → functional) for this application. Additive;
   * defaults to 1 for single-currency installs where the applied invoice is
   * in the base currency.
   */
  settlementFxRate?: number;
}
