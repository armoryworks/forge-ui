import { ProjectStatus } from './project-status.model';

export interface Project {
  id: number;
  projectNumber: string;
  name: string;
  description: string | null;
  customerId: number | null;
  customerName: string | null;
  salesOrderId: number | null;
  budgetTotal: number;
  actualTotal: number;
  committedTotal: number;
  estimateAtCompletionTotal: number;
  status: ProjectStatus;
  plannedStartDate: string | null;
  plannedEndDate: string | null;
  actualStartDate: string | null;
  actualEndDate: string | null;
  percentComplete: number | null;
  notes: string | null;
  createdAt: string;
}
