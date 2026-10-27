import { FmeaStatus } from './fmea-status.model';

export interface UpdateFmeaRequest {
  name?: string;
  status?: FmeaStatus;
  preparedBy?: string | null;
  responsibility?: string | null;
}
