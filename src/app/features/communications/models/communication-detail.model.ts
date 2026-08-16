import { CommunicationArtifact } from './communication-artifact.model';
import { PriorAgreement } from './prior-agreement.model';

export interface CommunicationLink {
  id: number;
  entityType: string;
  entityId: number;
}

export interface ThreadMessage {
  id: number;
  subject: string;
  fromAddress: string | null;
  occurredAt: string;
  flow: string;
}

/** Everything the review screen needs to decide whether to approve a draft. */
export interface CommunicationDetail {
  id: number;
  channel: string;
  flow: string;
  subject: string;
  body: string | null;
  fromAddress: string | null;
  occurredAt: string;
  durationMinutes: number | null;
  partyType: string | null;
  partyId: number | null;
  contactId: number | null;
  contactName: string | null;
  /** Only Exact may feed a draft order. Domain files the mail but authorizes nothing. */
  matchConfidence: 'Exact' | 'Domain' | 'Unmatched';
  isTriaged: boolean;
  handledByUserId: number | null;
  artifacts: CommunicationArtifact[];
  links: CommunicationLink[];
  priorAgreements: PriorAgreement[];
  thread: ThreadMessage[];
}
