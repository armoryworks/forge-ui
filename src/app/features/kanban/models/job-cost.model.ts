export interface JobCostSummary {
  jobId: number;
  jobNumber: string;
  quotedPrice: number;
  materialEstimated: number;
  materialActual: number;
  materialVariance: number;
  materialVariancePercent: number;
  laborEstimated: number;
  laborActual: number;
  laborVariance: number;
  laborVariancePercent: number;
  burdenEstimated: number;
  burdenActual: number;
  burdenVariance: number;
  subcontractEstimated: number;
  subcontractActual: number;
  subcontractVariance: number;
  totalEstimated: number;
  totalActual: number;
  totalVariance: number;
  totalVariancePercent: number;
  actualMargin: number;
  actualMarginPercent: number;
}

export interface MaterialIssue {
  id: number;
  jobId: number;
  partId: number;
  partNumber: string;
  partDescription: string;
  operationId: number | null;
  operationName: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
  issuedByName: string;
  issuedAt: string;
  lotNumber: string | null;
  issueType: 'Issue' | 'Return' | 'Scrap';
  notes: string | null;
}

export interface MaterialIssueRequest {
  partId: number;
  operationId?: number;
  quantity: number;
  binContentId?: number;
  storageLocationId?: number;
  lotNumber?: string;
  issueType?: 'Issue' | 'Return' | 'Scrap';
  notes?: string;
}

export interface LaborRate {
  id: number;
  userId: number;
  standardRatePerHour: number;
  overtimeRatePerHour: number;
  doubletimeRatePerHour: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
}

export interface JobProfitabilityRow {
  jobId: number;
  jobNumber: string;
  jobTitle: string;
  customerName: string | null;
  quotedPrice: number;
  actualCost: number;
  margin: number;
  marginPercent: number;
  materialCost: number;
  laborCost: number;
  burdenCost: number;
  subcontractCost: number;
  completedAt: string | null;
}
