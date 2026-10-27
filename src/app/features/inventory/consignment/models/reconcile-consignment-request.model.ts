export interface ReconcileConsignmentRequest {
  physicalCount: number | null;
  periodFrom: string | null;
  periodTo: string | null;
  createBill: boolean;
  vendorInvoiceNumber: string | null;
}
