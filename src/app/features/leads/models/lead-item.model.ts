import { LeadStatus } from './lead-status.type';
import { LeadEngagementShape } from './lead-engagement-shape.type';

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
}
