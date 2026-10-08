import { KioskAndonType } from './kiosk-andon-type.type';

export interface RaiseKioskAndonRequest {
  jobId: number;
  type: KioskAndonType;
  notes: string | null;
}
