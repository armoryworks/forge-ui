export interface CustomerReturnListItem {
  id: number;
  returnNumber: string;
  customerId: number;
  customerName: string;
  originalJobId: number;
  originalJobNumber: string;
  reworkJobId: number | null;
  reworkJobNumber: string | null;
  status: string;
  reason: string;
  returnDate: Date;
  createdAt: Date;
}
