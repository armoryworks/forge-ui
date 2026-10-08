import { QcInspectionResult } from './qc-inspection-result.model';

export interface QcInspectionDetail {
  id: number;
  jobId: number | null;
  jobNumber: string | null;
  jobTitle: string | null;
  productionRunId: number | null;
  productionRunNumber: string | null;
  templateId: number | null;
  templateName: string | null;
  partId: number | null;
  partNumber: string | null;
  partName: string | null;
  inspectorId: number;
  inspectorName: string;
  lotNumber: string | null;
  status: string;
  notes: string | null;
  completedAt: Date | null;
  results: QcInspectionResult[];
  createdAt: Date;
  updatedAt: Date;
}
