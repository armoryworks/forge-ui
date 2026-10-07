import { LotTraceShipment } from './lot-trace-shipment.model';

export interface LotTraceEvent {
  type: string;
  referenceNumber: string;
  description: string;
  date: Date;
  quantity: number | null;
  statusCode?: string | null;
  actor?: string | null;
}

export interface LotTrace {
  lotNumber: string;
  partNumber: string;
  partDescription: string;
  quantity: number;
  expirationDate: Date | null;
  supplierLotNumber: string | null;
  events: LotTraceEvent[];
  shippedTo?: LotTraceShipment[];
}
