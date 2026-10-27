import { AndonAlertStatus } from './andon-alert-status.type';
import { AndonAlertType } from './andon-alert-type.type';

export interface AndonAlert {
  id: number;
  workCenterId: number;
  workCenterName: string;
  type: AndonAlertType;
  status: AndonAlertStatus;
  requestedByName: string;
  requestedAt: string;
  acknowledgedByName: string | null;
  acknowledgedAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  responseTimeMinutes: number | null;
  resolutionTimeMinutes: number | null;
  notes: string | null;
  jobId: number | null;
  jobNumber: string | null;
}
