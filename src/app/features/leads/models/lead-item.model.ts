import { LeadStatus } from './lead-status.type';
import { LeadEngagementShape } from './lead-engagement-shape.type';

/** Phase 1r / Batch 5 — orthogonal to LeadStatus; tracks the outreach lifecycle. */
export type OutreachState =
  | 'Queued' | 'InProgress' | 'NoAnswer' | 'VoicemailLeft'
  | 'CallbackScheduled' | 'BadData' | 'Engaged' | 'Suppressed';

/** Phase 1r / Batch 13 — "can we actually make this?" gate, distinct from sales lost-reasons. */
export type CapabilityFitStatus = 'NotAssessed' | 'Fits' | 'DoesntFit' | 'NeedsReview';

/** Phase 1r / Batch 14 — NDA lifecycle state. */
export type NdaState = 'None' | 'Requested' | 'InForce' | 'Expired';

/** Phase 1r / Batch 14 — ITAR/EAR clearance for regulated-tech engagements. */
export type ExportControlClearance = 'NotApplicable' | 'Pending' | 'Cleared' | 'Denied';

export interface LeadItem {
  id: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: LeadStatus;
  notes: string | null;
  followUpDate: Date | null;
  lostReason: string | null;
  convertedCustomerId: number | null;
  createdAt: Date;
  updatedAt: Date;
  // Wave 7
  engagementShape?: LeadEngagementShape;
  customFieldValues?: string | null;
  // Phase 1j — engagement signals computed server-side from ActivityLog.
  /** Timestamp of the most recent activity-log row. Null = nothing logged
   *  since creation; UI falls back to createdAt for staleness display. */
  lastActivityAt?: string | null;
  /** Count of comm-flavoured activity rows in the last 30 days. */
  recentEngagementCount?: number;
  /** Server-computed: active lead with no activity in last 14 days. */
  isStale?: boolean;
  // Phase 1r — high-volume marketing arc.
  campaignId?: number | null;
  outreachState?: OutreachState;
  leadSourceId?: number | null;
  icpScore?: number | null;
  assignedToUserId?: number | null;
  accountId?: number | null;
  capabilityFit?: CapabilityFitStatus;
  ndaState?: NdaState;
  ndaSignedAt?: string | null;
  ndaExpiresAt?: string | null;
  exportControl?: ExportControlClearance;
  secondaryOwnerUserId?: number | null;
  partClassCode?: string | null;
}
