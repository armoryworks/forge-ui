import { LeadStatus } from './lead-status.type';

export interface UpdateLeadRequest {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: LeadStatus;
  notes?: string;
  followUpDate?: string;
  lostReason?: string;
}
