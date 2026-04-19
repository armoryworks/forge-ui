export interface DomainEventFailure {
  id: number;
  eventType: string;
  eventPayload: string;
  handlerName: string;
  errorMessage: string;
  failedAt: string;
  retryCount: number;
  lastRetryAt: string | null;
  status: string;
}
