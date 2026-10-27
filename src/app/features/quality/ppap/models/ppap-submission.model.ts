import { PpapElement } from './ppap-element.model';
import { PpapReason } from './ppap-reason.model';
import { PpapStatus } from './ppap-status.model';

export interface PpapSubmission {
  id: number;
  submissionNumber: string;
  partId: number;
  partNumber: string;
  partDescription: string;
  customerId: number;
  customerName: string;
  ppapLevel: number;
  status: PpapStatus;
  reason: PpapReason;
  partRevision: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  dueDate: string | null;
  customerContactName: string | null;
  customerResponseNotes: string | null;
  internalNotes: string | null;
  pswSignedByName: string | null;
  pswSignedAt: string | null;
  completedElements: number;
  requiredElements: number;
  elements: PpapElement[];
  createdAt: string;
}
