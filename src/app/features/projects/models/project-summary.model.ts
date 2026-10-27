import { WbsElementSummary } from './wbs-element-summary.model';

export interface ProjectSummary {
  projectId: number;
  budgetTotal: number;
  actualTotal: number;
  committedTotal: number;
  estimateAtCompletion: number;
  varianceAtCompletion: number;
  percentComplete: number;
  wbsTree: WbsElementSummary[];
}
