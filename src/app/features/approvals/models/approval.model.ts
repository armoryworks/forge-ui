export type ApproverType = 'SpecificUser' | 'Role' | 'Manager';
export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Escalated' | 'Cancelled' | 'AutoApproved';
export type ApprovalDecisionType = 'Approve' | 'Reject' | 'Delegate' | 'Escalate';

export interface ApprovalRequest {
  id: number;
  workflowName: string;
  entityType: string;
  entityId: number;
  entitySummary: string | null;
  amount: number | null;
  currentStepNumber: number;
  currentStepName: string | null;
  status: ApprovalRequestStatus;
  requestedByName: string;
  requestedAt: string;
  completedAt: string | null;
  decisions: ApprovalDecision[];
}

export interface ApprovalDecision {
  id: number;
  stepNumber: number;
  stepName: string;
  decidedByName: string;
  decision: ApprovalDecisionType;
  comments: string | null;
  decidedAt: string;
  delegatedToUserName: string | null;
}

export interface ApprovalWorkflow {
  id: number;
  name: string;
  entityType: string;
  isActive: boolean;
  description: string | null;
  activationConditionsJson: string | null;
  steps: ApprovalStep[];
  createdAt: string;
}

export interface ApprovalStep {
  id: number;
  stepNumber: number;
  name: string;
  approverType: ApproverType;
  approverUserId: number | null;
  approverUserName: string | null;
  approverRole: string | null;
  useDirectManager: boolean;
  autoApproveBelow: number | null;
  escalationHours: number | null;
  requireComments: boolean;
  allowDelegation: boolean;
}
