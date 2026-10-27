import { PpapElementStatus } from './ppap-element-status.model';

export interface UpdatePpapElementRequest {
  status?: PpapElementStatus;
  notes?: string | null;
}
