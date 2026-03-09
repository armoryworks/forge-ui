import { LeadStatus } from './lead-status.type';

export interface LeadItem {
  id: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  followUpDate: string | null;
  lostReason: string | null;
  convertedCustomerId: number | null;
  createdAt: string;
  updatedAt: string;
}
