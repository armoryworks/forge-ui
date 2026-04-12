export type SpcMeasurementType = 'Variable' | 'Attribute';
export type SpcOocSeverity = 'Warning' | 'OutOfControl' | 'OutOfSpec';
export type SpcOocStatus = 'Open' | 'Acknowledged' | 'CapaCreated' | 'Resolved';

export interface SpcCharacteristic {
  id: number;
  partId: number;
  partNumber: string;
  operationId: number | null;
  operationName: string | null;
  name: string;
  description: string | null;
  measurementType: SpcMeasurementType;
  nominalValue: number;
  upperSpecLimit: number;
  lowerSpecLimit: number;
  unitOfMeasure: string | null;
  decimalPlaces: number;
  sampleSize: number;
  sampleFrequency: string | null;
  gageId: number | null;
  isActive: boolean;
  notifyOnOoc: boolean;
  measurementCount: number;
  latestCpk: number | null;
}

export interface SpcMeasurement {
  id: number;
  characteristicId: number;
  jobId: number | null;
  productionRunId: number | null;
  lotNumber: string | null;
  measuredByName: string;
  measuredAt: string;
  subgroupNumber: number;
  values: number[];
  mean: number;
  range: number;
  stdDev: number;
  median: number;
  isOutOfSpec: boolean;
  isOutOfControl: boolean;
  oocRuleViolated: string | null;
  notes: string | null;
}

export interface SpcControlLimits {
  xBarUcl: number;
  xBarLcl: number;
  xBarCenterLine: number;
  rangeUcl: number;
  rangeLcl: number;
  rangeCenterLine: number;
  cp: number;
  cpk: number;
  pp: number;
  ppk: number;
  processSigma: number;
  sampleCount: number;
  isActive: boolean;
}

export interface SpcChartData {
  characteristicId: number;
  characteristicName: string;
  usl: number;
  lsl: number;
  nominal: number;
  activeLimits: SpcControlLimits | null;
  points: SpcChartPoint[];
}

export interface SpcChartPoint {
  subgroupNumber: number;
  measuredAt: string;
  mean: number;
  range: number;
  stdDev: number | null;
  isOoc: boolean;
  oocRule: string | null;
}

export interface SpcCapabilityReport {
  characteristicId: number;
  characteristicName: string;
  usl: number;
  lsl: number;
  nominal: number;
  cp: number;
  cpk: number;
  pp: number;
  ppk: number;
  mean: number;
  sigma: number;
  sampleCount: number;
  histogramBuckets: HistogramBucket[];
  normalCurve: NormalCurvePoint[];
}

export interface HistogramBucket {
  from: number;
  to: number;
  count: number;
}

export interface NormalCurvePoint {
  x: number;
  y: number;
}

export interface SpcOocEvent {
  id: number;
  characteristicId: number;
  characteristicName: string;
  partNumber: string;
  measurementId: number;
  detectedAt: string;
  ruleName: string;
  description: string;
  severity: SpcOocSeverity;
  status: SpcOocStatus;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  acknowledgmentNotes: string | null;
  capaId: number | null;
}

export interface RecordMeasurementRequest {
  characteristicId: number;
  jobId?: number;
  productionRunId?: number;
  lotNumber?: string;
  subgroups: SpcSubgroupEntry[];
}

export interface SpcSubgroupEntry {
  values: number[];
  notes?: string;
}
