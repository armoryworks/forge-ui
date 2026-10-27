import { PpapReason } from './ppap-reason.model';

export interface CreatePpapRequest {
  partId: number;
  customerId: number;
  ppapLevel: number;
  reason: PpapReason;
  partRevision?: string | null;
  dueDate?: string | null;
  customerContactName?: string | null;
  internalNotes?: string | null;
}
