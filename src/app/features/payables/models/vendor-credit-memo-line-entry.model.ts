/** A line being built in the vendor credit memo dialog. */
export interface VendorCreditMemoLineEntry {
  vendorBillLineId: number | null;
  partId: number | null;
  description: string;
  quantity: number;
  unitPrice: number;
  maxQuantity: number | null;
  maxUnitPrice: number | null;
}
