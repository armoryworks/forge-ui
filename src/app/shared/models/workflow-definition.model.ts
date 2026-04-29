import { WorkflowStepDefinition } from './workflow-step-definition.model';

/**
 * Workflow Pattern Phase 4 — Mirror of `WorkflowDefinitionResponseModel`
 * (server). The server stores steps as a JSON string in the DB (`stepsJson`)
 * but the parsed `steps` array is more useful at the UI tier; the service
 * does the parse once at fetch time.
 */
export interface WorkflowDefinition {
  id: number;
  definitionId: string;
  entityType: string;
  defaultMode: 'express' | 'guided';
  steps: WorkflowStepDefinition[];
  stepsJson: string;
  expressTemplateComponent: string | null;
  isSeedData: boolean;
}
