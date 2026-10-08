import { LotTraceInspection } from './lot-trace-inspection.model';
import { LotTraceJob } from './lot-trace-job.model';
import { LotTraceNcr } from './lot-trace-ncr.model';
import { LotTraceReceipt } from './lot-trace-receipt.model';
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
  receivedFrom?: LotTraceReceipt[];
  inspections?: LotTraceInspection[];
  nonConformances?: LotTraceNcr[];
  producingJob?: LotTraceJob | null;
}
