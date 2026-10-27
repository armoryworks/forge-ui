import { DeliverableStatus } from './deliverable-status.model';

export interface Deliverable {
  id: number;
  name: string;
  description: string | null;
  jobId: number | null;
  projectId: number | null;
  customerId: number | null;
  deliverableTypeId: number;
  status: DeliverableStatus;
  dueDate: string | null;
  deliveredAt: string | null;
  deliveredByUserId: number | null;
  fileAttachmentIds: string | null;
  cloudLinkExternalId: string | null;
  createdAt: string;
  updatedAt: string;
}
