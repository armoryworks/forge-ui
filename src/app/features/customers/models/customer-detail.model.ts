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
}
