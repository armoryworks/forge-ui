export interface CreateLeadRequest {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  followUpDate?: string;
}
