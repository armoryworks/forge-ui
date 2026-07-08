import { ScheduleMilestone } from './schedule-milestone.model';

export interface SalesOrderStageLine {
  id: number;
  salesOrderLineId: number;
  partNumber: string | null;
  description: string;
  quantity: number;
}

export interface SalesOrderStageLot {
  id: number;
  lotNumber: string;
  quantity: number;
}

export type SalesOrderStageStatus =
  | 'Planned' | 'InProduction' | 'ReadyToShip' | 'Shipped' | 'Closed';

export interface SalesOrderStage {
  id: number;
  sequence: number;
  name: string;
  status: SalesOrderStageStatus;
  plannedProductionComplete: string | null;
  plannedShipDate: string | null;
  actualShipDate: string | null;
  shipmentId: number | null;
  shipmentNumber: string | null;
  paymentMilestoneId: number | null;
  paymentMilestoneName: string | null;
  notes: string | null;
  lines: SalesOrderStageLine[];
  lots: SalesOrderStageLot[];
}

export interface SalesOrderStages {
  salesOrderId: number;
  isActivated: boolean;
  stages: SalesOrderStage[];
  derivedTimeline: ScheduleMilestone[];
}
