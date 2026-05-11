import { LeadEngagementShape } from './lead-engagement-shape.type';

export interface CreateLeadRequest {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
  followUpDate?: string;
  // Wave 7 — engagement-shape axis from the New Lead fork dialog.
  // Default Unknown round-trips for the "Quick add" path.
  engagementShape?: LeadEngagementShape;
  // JSONB string. Per-shape specialised fields (RFQ parts list,
  // decision-maker, etc.) land here as a serialised JSON object so
  // adding new shapes doesn't require schema work.
  customFieldValues?: string;
  // Phase 1r / Batch 12 — optional B2B parent account at intake.
  accountId?: number | null;
}
