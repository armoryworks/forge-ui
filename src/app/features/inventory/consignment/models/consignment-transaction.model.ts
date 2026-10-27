export interface ConsignmentTransaction {
  id: number;
  agreementId: number;
  type: 'Receipt' | 'Consumption' | 'Return' | 'Adjustment' | 'Reconciliation';
  quantity: number;
  unitPrice: number;
  extendedAmount: number;
  purchaseOrderId: number | null;
  invoiceId: number | null;
  binContentId: number | null;
  storageLocationId: number | null;
  storageLocationName: string | null;
  lotNumber: string | null;
  jobId: number | null;
  jobNumber: string | null;
  vendorBillId: number | null;
  vendorBillNumber: string | null;
  journalEntryId: number | null;
  notes: string | null;
  createdAt: string;
}
