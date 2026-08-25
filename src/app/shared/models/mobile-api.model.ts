import { ScanKind } from '../utils/scan-code';

export interface ScanResolveResult {
  kind: ScanKind;
  id: number | null;
  code: string;
  label: string;
  subtitle: string | null;
}

export interface JobActivityEntry {
  id: number;
  action: string;
  description: string;
  userInitials: string | null;
  userName: string | null;
  createdAt: string;
}

export interface JobStatus {
  id: number;
  jobNumber: string;
  title: string;
  customerName: string | null;
  stageId: number;
  stageName: string;
  stageColor: string;
  dueDate: string | null;
  isOverdue: boolean;
  nextStageId: number | null;
  nextStageName: string | null;
  previousStageId: number | null;
  previousStageName: string | null;
  rowVersion: number;
  recentActivity: JobActivityEntry[];
}

export interface JobAdvanceResult {
  status: JobStatus;
  previousStageId: number;
  previousStageName: string;
  collapsed: boolean;
}

export interface JobNote {
  id: number;
  text: string;
  createdAt: string;
}

export interface UploadedJobFile {
  id: number;
  fileName: string;
}
