import { LeadStatus } from './lead-status.type';
import { LeadEngagementShape } from './lead-engagement-shape.type';
import { CapabilityFitStatus, NdaState, ExportControlClearance } from './lead-item.model';

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
  engagementShape?: LeadEngagementShape;
  customFieldValues?: string;
  // Phase 1r / Batch 13-14 — manufacturing/compliance classifications.
  capabilityFit?: CapabilityFitStatus;
  ndaState?: NdaState;
  ndaSignedAt?: string;
  ndaExpiresAt?: string;
  exportControl?: ExportControlClearance;
  /** Phase 1r / Batch 12 — multi-contact B2B parent. Null clears the link. */
  accountId?: number | null;
}
