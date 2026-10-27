import { PpapElementStatus } from './ppap-element-status.model';

export interface PpapElement {
  id: number;
  elementNumber: number;
  elementName: string;
  status: PpapElementStatus;
  isRequired: boolean;
  notes: string | null;
  assignedToName: string | null;
  completedAt: string | null;
  attachmentCount: number;
}
