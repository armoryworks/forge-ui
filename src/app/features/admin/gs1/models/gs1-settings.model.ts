/**
 * GS1 GTIN barcode-identity settings for the install. When `configured` is
 * false the company has not entered a licensed GS1 company prefix, so parts
 * fall back to their free internal barcode. `remainingCapacity` is how many
 * more GTINs can still be allocated under the current prefix.
 */
export interface Gs1Settings {
  configured: boolean;
  companyPrefix: string | null;
  nextItemReference: number;
  remainingCapacity: number;
}
