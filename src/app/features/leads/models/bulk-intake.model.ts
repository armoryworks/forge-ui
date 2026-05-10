export type BulkLeadIntakeStrategy =
  | 'ColdCall'
  | 'ColdEmail'
  | 'TradeShowFollowup'
  | 'WebinarAttendee'
  | 'ListPurchase'
  | 'ManualEntry';

export interface BulkLeadIntakeRow {
  externalRowKey: string;
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  source?: string;
  notes?: string;
}

export interface BulkLeadIntakeRequest {
  strategy: BulkLeadIntakeStrategy;
  campaignTag?: string;
  rows: BulkLeadIntakeRow[];
}

export type BulkLeadIntakeRowStatus =
  | 'Created'
  | 'MissingRequiredField'
  | 'DuplicateExistingLead'
  | 'DuplicateExistingContact'
  | 'DuplicateWithinBatch'
  | 'SuppressedOptOut'
  | 'InCooldown'
  | 'Invalid';

export interface BulkLeadIntakeRowResult {
  externalRowKey: string;
  status: BulkLeadIntakeRowStatus;
  createdLeadId: number | null;
  matchedEntityId: number | null;
  matchedEntityType: string | null;
  reason: string | null;
}

export interface BulkLeadIntakeResponse {
  totalRows: number;
  createdCount: number;
  skippedCount: number;
  results: BulkLeadIntakeRowResult[];
}
