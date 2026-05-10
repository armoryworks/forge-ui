export interface SuppressedLeadSummary {
  leadId: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  emailOptOut: boolean;
  callOptOut: boolean;
  smsOptOut: boolean;
  cooldownUntil: string | null;
  cooldownReasonCode: string | null;
  prefsUpdatedAt: string;
}

export interface OutreachPreferences {
  id: number;
  ownerId: number;
  emailOptOut: boolean;
  emailOptOutAt: string | null;
  emailOptOutSource: string | null;
  callOptOut: boolean;
  callOptOutAt: string | null;
  callOptOutSource: string | null;
  smsOptOut: boolean;
  smsOptOutAt: string | null;
  smsOptOutSource: string | null;
  cooldownUntil: string | null;
  cooldownReasonCode: string | null;
  cooldownNotes: string | null;
}

export interface UpdateOutreachPreferencesRequest {
  emailOptOut?: boolean;
  emailOptOutSource?: string;
  callOptOut?: boolean;
  callOptOutSource?: string;
  smsOptOut?: boolean;
  smsOptOutSource?: string;
  cooldownUntil?: string | null;
  cooldownReasonCode?: string;
  cooldownNotes?: string;
}
