/** Mirrors forge-api Forge.Core.Models.Sequence* (Gated Sequence Engine, CAP-CROSS-SEQUENCES). */

export type SequenceDefinitionStatus = 'Draft' | 'Published' | 'Retired';
export type SequenceInstanceStatus = 'Running' | 'Completed' | 'Cancelled';
export type SequenceStepStatus = 'Pending' | 'Ready' | 'InProgress' | 'Complete' | 'Skipped';
export type SequenceGateVerdict = 'Unknown' | 'Go' | 'NoGo';
export type SequenceJoinPolicy = 'All' | 'Any';
export type SequenceGateSourceType = 'ManualClearance' | 'TimeWindow' | 'ResourceClock' | 'Approval' | 'Custom';
export type SequenceExpiryAction = 'Block' | 'Flag' | 'Escalate';

export interface SequenceStepDefinition {
  key: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  joinPolicy: SequenceJoinPolicy;
  maxDwellMinutes?: number | null;
  dwellExpiryAction: SequenceExpiryAction;
  escalateRole?: string | null;
}

export interface SequenceEdgeDefinition {
  fromStepKey: string;
  toStepKey: string;
  isRework: boolean;
}

export interface SequenceGateDefinition {
  stepKey: string;
  key: string;
  name: string;
  sourceType: SequenceGateSourceType;
  configJson: string;
  expiryAction: SequenceExpiryAction;
  escalateRole?: string | null;
}

export interface SequenceDefinitionRequest {
  code: string;
  name: string;
  description?: string | null;
  subjectEntityType?: string | null;
  steps: SequenceStepDefinition[];
  edges: SequenceEdgeDefinition[];
  gates: SequenceGateDefinition[];
  autoStartOnSubjectCreate: boolean;
}

export interface SequenceDefinition extends SequenceDefinitionRequest {
  id: number;
  version: number;
  status: SequenceDefinitionStatus;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SequenceStepInstance {
  stepKey: string;
  name: string;
  sortOrder: number;
  status: SequenceStepStatus;
  isBlocked: boolean;
  blockedReason?: string | null;
  predecessors: string[];
  readyAt?: string | null;
  startedAt?: string | null;
  startedByUserId?: number | null;
  completedAt?: string | null;
  completedByUserId?: number | null;
  skipReason?: string | null;
  dwellExpiresAt?: string | null;
  dwellFiredAt?: string | null;
}

export interface SequenceGateInstance {
  stepKey: string;
  gateKey: string;
  name: string;
  sourceType: SequenceGateSourceType;
  verdict: SequenceGateVerdict;
  reason?: string | null;
  lastEvaluatedAt?: string | null;
  clearedAt?: string | null;
  clearedByUserId?: number | null;
  overriddenAt?: string | null;
  overriddenByUserId?: number | null;
  overrideReason?: string | null;
}

export interface SequenceInstance {
  id: number;
  definitionId: number;
  definitionCode: string;
  definitionVersion: number;
  definitionName: string;
  subjectEntityType?: string | null;
  subjectEntityId?: number | null;
  status: SequenceInstanceStatus;
  startedAt: string;
  startedByUserId?: number | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string | null;
  version: number;
  steps: SequenceStepInstance[];
  gates: SequenceGateInstance[];
}

export interface SequenceEvent {
  id: number;
  type: string;
  stepKey?: string | null;
  gateKey?: string | null;
  payloadJson?: string | null;
  occurredAt: string;
  actorUserId?: number | null;
}

export interface SequenceResourceClock {
  id: number;
  resourceType: string;
  resourceId: number;
  expiresAt: string;
  expiryAction: SequenceExpiryAction;
  escalateRole?: string | null;
  note?: string | null;
  firedAt?: string | null;
  isExpired: boolean;
}

export interface StartSequenceRequest {
  definitionId?: number | null;
  code?: string | null;
  subjectEntityType?: string | null;
  subjectEntityId?: number | null;
}

export interface SequenceResourceClockRequest {
  resourceType: string;
  resourceId: number;
  expiresAt: string;
  expiryAction: SequenceExpiryAction;
  escalateRole?: string | null;
  note?: string | null;
}
