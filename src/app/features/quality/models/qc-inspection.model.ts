import { QcInspectionResult } from './qc-inspection-result.model';

export interface QcInspection {
  id: number;
  jobId: number | null;
  jobNumber: string | null;
  productionRunId: number | null;
  templateId: number | null;
  templateName: string | null;
  inspectorId: number;
  inspectorName: string;
  lotNumber: string | null;
  status: string;
  notes: string | null;
  completedAt: string | null;
  results: QcInspectionResult[];
  createdAt: string;
}
