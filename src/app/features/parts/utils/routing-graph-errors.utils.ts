import { HttpErrorResponse } from '@angular/common/http';

import { RoutingGraphIssue } from '../models/routing-graph-issue.model';

export const ROUTING_GRAPH_INVALID_CODE = 'routing-graph-invalid';
export const ROUTING_GRAPH_STALE_CODE = 'routing-graph-stale';

export function routingGraphIssuesOf(error: unknown): RoutingGraphIssue[] | null {
  if (!(error instanceof HttpErrorResponse) || error.status !== 422) return null;
  const body = error.error as { code?: string; issues?: RoutingGraphIssue[] } | null;
  return body?.code === ROUTING_GRAPH_INVALID_CODE && Array.isArray(body.issues) ? body.issues : null;
}

export function isRoutingGraphStale(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return false;
  return (error.error as { code?: string } | null)?.code === ROUTING_GRAPH_STALE_CODE;
}
