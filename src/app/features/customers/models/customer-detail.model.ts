import { Contact } from './contact.model';
import { CustomerJob } from './customer-job.model';

export interface CustomerDetail {
  id: number;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  externalId: string | null;
  externalRef: string | null;
  provider: string | null;
  createdAt: Date;
  updatedAt: Date;
  contacts: Contact[];
  jobs: CustomerJob[];
  // Phase 1r / Batch 15-16 — regulated-industry flags + reference-customer consent.
  isFdaRegulated?: boolean;
  isAerospace?: boolean;
  isAutomotive?: boolean;
  isItarControlled?: boolean;
  isReferenceOk?: boolean;
  referenceNotes?: string | null;
}
