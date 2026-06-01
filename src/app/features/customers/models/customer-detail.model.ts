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
  // Phase B of the customer workflow migration (2026-05-31) — credit + tax
  // fields the new guided wizard's Credit & Tax step writes and re-hydrates
  // from. The server entity carries them; the response mapper may or may not
  // be sending them yet (CustomerMapper ignores most fields today). When the
  // mapper catches up, these properties round-trip correctly with no UI
  // change. Until then, the workflow step re-mounts to blank fields on
  // re-entry — same as a fresh entry, no regression.
  creditLimit?: number | null;
  defaultCurrency?: string | null;
  isTaxExempt?: boolean;
  taxExemptionId?: string | null;
}
