export interface CreatePaymentApplicationRequest {
  invoiceId: number;
  amount: number;
  /**
   * Settlement FX rate (cash → functional) for this application. Additive;
   * defaults to 1 for single-currency installs where the applied invoice is
   * in the base currency.
   */
  settlementFxRate?: number;
  /** Early-payment discount taken; omitted = the discount the terms give automatically, 0 = none. */
  discountAmount?: number;
  /** Lets an Admin or Manager take a discount outside the terms. */
  allowDiscountOverride?: boolean;
}
