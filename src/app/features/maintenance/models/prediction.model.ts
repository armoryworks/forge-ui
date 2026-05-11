export type MaintenancePredictionSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type MaintenancePredictionStatus =
  | 'Predicted' | 'Acknowledged' | 'MaintenanceScheduled'
  | 'Resolved' | 'FalsePositive' | 'Expired';

export interface MaintenancePrediction {
  id: number;
  workCenterId: number;
  workCenterName: string;
  predictionType: string;
  confidencePercent: number;
  predictedFailureDate: string;
  remainingUsefulLifeHours: number | null;
  modelId: string;
  modelVersion: string;
  severity: MaintenancePredictionSeverity;
  status: MaintenancePredictionStatus;
  predictedAt: string;
  acknowledgedAt: string | null;
  acknowledgedByName: string | null;
  preventiveMaintenanceJobId: number | null;
  resolutionNotes: string | null;
  wasAccurate: boolean;
  inputFeaturesJson: string;
}

export interface PredictiveMaintenanceDashboard {
  activePredictions: number;
  criticalPredictions: number;
  pendingAcknowledgment: number;
  maintenanceScheduled: number;
  overallModelAccuracy: number;
  estimatedDowntimePreventedHours: number;
  workCenterRisks: WorkCenterRiskScore[];
  upcomingPredictions: UpcomingPrediction[];
}

export interface WorkCenterRiskScore {
  workCenterId: number;
  workCenterName: string;
  riskScore: number;
  highestSeverityPrediction: string;
  nextPredictedFailure: string | null;
}

export interface UpcomingPrediction {
  id: number;
  workCenterName: string;
  predictionType: string;
  confidencePercent: number;
  predictedFailureDate: string;
  severity: string;
}

export interface ResolvePredictionRequest {
  notes: string;
}
