/** Phase 1r / Batch 11 — assignment-rule admin models. */
export type AssignmentRuleKind = 'RoundRobin' | 'Territory' | 'Industry' | 'AccountBased';

export interface AssignmentRule {
  id: number;
  name: string;
  kind: AssignmentRuleKind;
  priority: number;
  isActive: boolean;
  spec: string | null;
  createdAt: string;
}

export interface CreateAssignmentRuleRequest {
  name: string;
  kind: AssignmentRuleKind;
  priority: number;
  spec: string | null;
}

export interface UpdateAssignmentRuleRequest {
  name?: string;
  kind?: AssignmentRuleKind;
  priority?: number;
  isActive: boolean;
  spec?: string | null;
}
