export type GageStatus = 'InService' | 'DueForCalibration' | 'OutForCalibration' | 'OutOfService' | 'Retired';
export type CalibrationResult = 'Pass' | 'Fail' | 'Adjusted' | 'OutOfTolerance';

export interface Gage {
  id: number;
  gageNumber: string;
  description: string;
  gageType: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  calibrationIntervalDays: number;
  lastCalibratedAt: string | null;
  nextCalibrationDue: string | null;
  status: GageStatus;
  locationId: number | null;
  locationName: string | null;
  assetId: number | null;
  assetName: string | null;
  accuracySpec: string | null;
  rangeSpec: string | null;
  resolution: string | null;
  notes: string | null;
  createdAt: string;
  calibrationCount: number;
}

export interface CalibrationRecord {
  id: number;
  gageId: number;
  calibratedById: number;
  calibratedAt: string;
  result: CalibrationResult;
  labName: string | null;
  certificateFileId: number | null;
  standardsUsed: string | null;
  asFoundCondition: string | null;
  asLeftCondition: string | null;
  nextCalibrationDue: string | null;
  notes: string | null;
}

export interface CreateGageRequest {
  description: string;
  gageType?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  calibrationIntervalDays: number;
  locationId?: number;
  assetId?: number;
  accuracySpec?: string;
  rangeSpec?: string;
  resolution?: string;
  notes?: string;
}

export interface CreateCalibrationRecordRequest {
  calibratedAt: string;
  result: CalibrationResult;
  labName?: string;
  certificateFileId?: number;
  standardsUsed?: string;
  asFoundCondition?: string;
  asLeftCondition?: string;
  notes?: string;
}
