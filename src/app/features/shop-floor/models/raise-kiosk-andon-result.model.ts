import { KioskAndonType } from './kiosk-andon-type.type';

export interface RaiseKioskAndonResult {
  alertId: number;
  type: KioskAndonType;
  jobId: number;
  jobNumber: string;
  operationId: number;
  operationStepNumber: number;
  operationTitle: string;
  workCenterId: number;
  workCenterName: string;
}
