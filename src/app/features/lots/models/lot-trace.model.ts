export interface LotTraceEvent {
  type: string;
  referenceNumber: string;
  description: string;
  date: Date;
  quantity: number | null;
}

export interface LotTrace {
  lotNumber: string;
  partNumber: string;
  partDescription: string;
  quantity: number;
  expirationDate: Date | null;
  supplierLotNumber: string | null;
  events: LotTraceEvent[];
}
