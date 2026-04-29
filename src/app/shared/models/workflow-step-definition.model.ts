/**
 * Workflow Pattern Phase 4 — Mirror of `WorkflowStepDefinition` (server).
 *
 * One step inside a `WorkflowDefinition`. References entity readiness
 * validators by id (D6) — no inline predicates here. The shell uses
 * `componentName` to instantiate the step's UI via the step registry.
 */
export interface WorkflowStepDefinition {
  id: string;
  labelKey: string;
  componentName: string;
  required: boolean;
  completionGates: string[];
}
