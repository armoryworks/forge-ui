export type EcoChangeType = 'New' | 'Revision' | 'Obsolescence' | 'CostReduction' | 'QualityImprovement';
export type EcoStatus = 'Draft' | 'Review' | 'Approved' | 'InImplementation' | 'Implemented' | 'Cancelled';
export type EcoPriority = 'Low' | 'Normal' | 'High' | 'Critical';

export interface Eco {
  id: number;
  ecoNumber: string;
  title: string;
  description: string;
  changeType: EcoChangeType;
  status: EcoStatus;
  priority: EcoPriority;
  reasonForChange?: string;
  impactAnalysis?: string;
  effectiveDate?: string;
  requestedById: number;
  requestedByName: string;
  approvedByName?: string;
  approvedAt?: string;
  implementedAt?: string;
  affectedItemCount: number;
  createdAt: string;
  affectedItems: EcoAffectedItem[];
}

export interface EcoAffectedItem {
  id: number;
  entityType: string;
  entityId: number;
  changeDescription: string;
  oldValue?: string;
  newValue?: string;
  isImplemented: boolean;
}

export interface CreateEcoRequest {
  title: string;
  description: string;
  changeType: EcoChangeType;
  priority: EcoPriority;
  reasonForChange?: string;
  impactAnalysis?: string;
  effectiveDate?: string;
}

export interface UpdateEcoRequest {
  title?: string;
  description?: string;
  changeType?: EcoChangeType;
  priority?: EcoPriority;
  reasonForChange?: string;
  impactAnalysis?: string;
  effectiveDate?: string;
}

export interface CreateEcoAffectedItemRequest {
  entityType: string;
  entityId: number;
  changeDescription: string;
  oldValue?: string;
  newValue?: string;
}
