export type OutreachState =
  | 'Queued'
  | 'InProgress'
  | 'NoAnswer'
  | 'VoicemailLeft'
  | 'CallbackScheduled'
  | 'BadData'
  | 'Engaged'
  | 'Suppressed';

export interface QueueLead {
  id: number;
  companyName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  notes: string | null;
  status: string;
  outreachState: OutreachState;
  campaignId: number | null;
  campaignName: string | null;
  lastActivityAt: string | null;
  cooldownUntil: string | null;
  emailOptOut: boolean;
  callOptOut: boolean;
}

export interface PullQueueRequest {
  campaignId?: number;
  count?: number;
}

export interface DispositionRequest {
  nextState: OutreachState;
  notes?: string;
  callbackAt?: string;
}
