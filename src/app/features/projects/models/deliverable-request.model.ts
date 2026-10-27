import { DeliverableStatus } from './deliverable-status.model';

export interface DeliverableRequest {
  name: string;
  description: string | null;
  jobId: number | null;
  projectId: number | null;
  customerId: number | null;
  deliverableTypeId: number;
  status?: DeliverableStatus;
  dueDate: string | null;
  fileAttachmentIds: string | null;
  cloudLinkExternalId: string | null;
}
