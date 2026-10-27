import { FmeaType } from './fmea-type.model';

export interface CreateFmeaRequest {
  name: string;
  type: FmeaType;
  partId?: number | null;
  operationId?: number | null;
  preparedBy?: string | null;
  responsibility?: string | null;
}
