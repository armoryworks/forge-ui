export interface MrpRun {
  id: number;
  runNumber: string;
  runType: MrpRunType;
  status: MrpRunStatus;
  isSimulation: boolean;
  startedAt: string | null;
  completedAt: string | null;
  planningHorizonDays: number;
  totalDemandCount: number;
  totalSupplyCount: number;
  plannedOrderCount: number;
  exceptionCount: number;
  errorMessage: string | null;
  initiatedByUserId: number | null;
}

export type MrpRunType = 'Full' | 'NetChange' | 'Simulation';
export type MrpRunStatus = 'Queued' | 'Running' | 'Completed' | 'Failed';
export type MrpPlannedOrderStatus = 'Planned' | 'Firmed' | 'Released' | 'Cancelled';
export type MrpOrderType = 'Purchase' | 'Manufacture';
export type MrpDemandSource = 'SalesOrder' | 'MasterSchedule' | 'Forecast' | 'ManualDemand' | 'DependentDemand';
export type MrpSupplySource = 'OnHand' | 'PurchaseOrder' | 'PlannedOrder' | 'ProductionRun' | 'InTransit';
export type MrpExceptionType = 'Expedite' | 'Defer' | 'Cancel' | 'PastDue' | 'ShortSupply' | 'OverSupply' | 'LeadTimeViolation';

export interface MrpPlannedOrder {
  id: number;
  mrpRunId: number;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  orderType: MrpOrderType;
  status: MrpPlannedOrderStatus;
  quantity: number;
  startDate: string;
  dueDate: string;
  isFirmed: boolean;
  releasedPurchaseOrderId: number | null;
  releasedJobId: number | null;
  notes: string | null;
}

export interface MrpException {
  id: number;
  mrpRunId: number;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  exceptionType: MrpExceptionType;
  message: string;
  suggestedAction: string | null;
  isResolved: boolean;
  resolvedByUserId: number | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
}

export interface MrpPartPlan {
  partId: number;
  partNumber: string;
  description: string | null;
  buckets: MrpTimeBucket[];
}

export interface MrpTimeBucket {
  periodStart: string;
  periodEnd: string;
  grossRequirements: number;
  scheduledReceipts: number;
  plannedOrderReceipts: number;
  projectedOnHand: number;
  netRequirements: number;
  plannedOrderReleases: number;
}

export interface MrpPegging {
  demandId: number;
  demandSource: MrpDemandSource;
  partId: number;
  partNumber: string;
  demandQuantity: number;
  requiredDate: string;
  supplyId: number | null;
  supplySource: MrpSupplySource | null;
  supplyQuantity: number | null;
  supplyDate: string | null;
  plannedOrderId: number | null;
  plannedOrderQuantity: number | null;
}

export interface MasterSchedule {
  id: number;
  name: string;
  description: string | null;
  status: MasterScheduleStatus;
  periodStart: string;
  periodEnd: string;
  createdByUserId: number;
  createdAt: string;
  lineCount: number;
}

export type MasterScheduleStatus = 'Draft' | 'Active' | 'Completed' | 'Cancelled';

export interface MasterScheduleDetail extends Omit<MasterSchedule, 'lineCount'> {
  lines: MasterScheduleLine[];
}

export interface MasterScheduleLine {
  id: number;
  masterScheduleId: number;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  quantity: number;
  dueDate: string;
  notes: string | null;
}

export interface MpsVsActual {
  partId: number;
  partNumber: string;
  partDescription: string | null;
  plannedQuantity: number;
  actualQuantity: number;
  variance: number;
  variancePercent: number;
}

export interface DemandForecast {
  id: number;
  name: string;
  partId: number;
  partNumber: string;
  partDescription: string | null;
  method: ForecastMethod;
  status: ForecastStatus;
  historicalPeriods: number;
  forecastPeriods: number;
  smoothingFactor: number | null;
  forecastStartDate: string;
  forecastBuckets: ForecastBucket[] | null;
  appliedToMasterScheduleId: number | null;
  overrideCount: number;
  createdAt: string;
}

export type ForecastMethod = 'MovingAverage' | 'ExponentialSmoothing' | 'WeightedMovingAverage';
export type ForecastStatus = 'Draft' | 'Approved' | 'Applied' | 'Expired';

export interface ForecastBucket {
  periodStart: string;
  periodEnd: string;
  forecastedQuantity: number;
  historicalQuantity: number | null;
  overrideQuantity: number | null;
}

// Request models
export interface ExecuteMrpRunRequest {
  runType?: MrpRunType;
  planningHorizonDays?: number;
  partIds?: number[];
}

export interface CreateMasterScheduleRequest {
  name: string;
  description?: string;
  periodStart: string;
  periodEnd: string;
  lines: { partId: number; quantity: number; dueDate: string; notes?: string }[];
}

export interface UpdateMasterScheduleRequest extends CreateMasterScheduleRequest {
  lines: { id?: number; partId: number; quantity: number; dueDate: string; notes?: string }[];
}

export interface GenerateForecastRequest {
  partId: number;
  name: string;
  method?: ForecastMethod;
  historicalPeriods?: number;
  forecastPeriods?: number;
  smoothingFactor?: number;
}
