export interface WebhookSubscription {
  id: number;
  url: string;
  eventTypesJson: string;
  isActive: boolean;
  failureCount: number;
  maxRetries: number;
  lastDeliveredAt: string | null;
  lastFailedAt: string | null;
  autoDisableOnFailure: boolean;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  headersJson: string | null;
  secret: string | null;
}

export interface WebhookDelivery {
  id: number;
  subscriptionId: number;
  eventType: string;
  statusCode: number | null;
  durationMs: number;
  attemptedAt: string;
  attemptNumber: number;
  isSuccess: boolean;
  errorMessage: string | null;
  responseBody: string | null;
}

export interface CreateWebhookSubscriptionRequest {
  url: string;
  eventTypesJson: string;
  secret: string | null;
  description: string | null;
  headersJson: string | null;
  maxRetries: number;
  autoDisableOnFailure: boolean;
}

export interface UpdateWebhookSubscriptionRequest {
  url: string;
  eventTypesJson: string;
  description: string | null;
  headersJson: string | null;
  maxRetries: number;
  autoDisableOnFailure: boolean;
  isActive: boolean;
  rotateSecret: boolean;
}
