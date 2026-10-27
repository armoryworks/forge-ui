import { FmeaItem } from './fmea-item.model';
import { FmeaStatus } from './fmea-status.model';
import { FmeaType } from './fmea-type.model';

export interface Fmea {
  id: number;
  fmeaNumber: string;
  name: string;
  type: FmeaType;
  partId: number | null;
  partNumber: string | null;
  operationId: number | null;
  operationName: string | null;
  status: FmeaStatus;
  preparedBy: string | null;
  responsibility: string | null;
  originalDate: string | null;
  revisionDate: string | null;
  revisionNumber: number;
  ppapSubmissionId: number | null;
  highRpnCount: number;
  maxRpn: number;
  items: FmeaItem[];
  createdAt: string;
}
