export type OutboxProvider = 'Email' | 'DocuSeal' | 'QuickBooks' | 'Shipping' | 'Webhook' | 'Sms';

export type OutboxStatus = 'Pending' | 'InFlight' | 'Sent' | 'Failed' | 'DeadLetter';

export interface OutboxEntry {
  id: number;
  provider: OutboxProvider;
  operationKey: string;
  status: OutboxStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  sentAt: string | null;
  lastError: string | null;
  entityType: string | null;
  entityId: number | null;
  createdAt: string;
}
