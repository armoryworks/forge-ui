export interface LotTraceEvent {
  type: string;
  referenceNumber: string;
  description: string;
  date: string;
  quantity: number | null;
}

export interface LotTrace {
  lotNumber: string;
  partNumber: string;
  partDescription: string;
  quantity: number;
  expirationDate: string | null;
  supplierLotNumber: string | null;
  events: LotTraceEvent[];
}
