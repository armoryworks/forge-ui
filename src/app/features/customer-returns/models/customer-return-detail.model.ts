export interface CustomerReturnDetail {
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
  notes: string | null;
  returnDate: Date;
  inspectedById: number | null;
  inspectedByName: string | null;
  inspectedAt: Date | null;
  inspectionNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
