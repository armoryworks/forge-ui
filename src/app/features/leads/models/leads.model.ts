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

export interface CreateLeadRequest {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  followUpDate?: string;
}

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

export type LeadStatus = 'New' | 'Contacted' | 'Quoting' | 'Converted' | 'Lost';
