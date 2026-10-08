export interface SendOutSubcontractRequest {
  quantity: number;
  unitCost: number;
  expectedReturnDate: string | null;
  createPurchaseOrder: boolean;
}
