export interface VendorReturnListItem {
  id: number;
  returnNumber: string;
  vendorId: number;
  vendorName: string;
  nonConformanceId: number | null;
  ncrNumber: string | null;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
  status: string;
  quantity: number;
  expectedCredit: number;
  currencyId: number;
  currencyCode: string | null;
  shipDate: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  vendorCreditMemoId: number | null;
  vendorCreditMemoNumber: string | null;
  createdAt: string;
}
