import { HttpErrorResponse } from '@angular/common/http';

/** The server's Problem Details `detail` text for an HTTP error, or null when there is none. */
export function httpProblemDetail(err: unknown): string | null {
  const body: unknown = err instanceof HttpErrorResponse ? err.error : null;
  if (!body || typeof body !== 'object') return null;
  const detail = (body as Record<string, unknown>)['detail'];
  return typeof detail === 'string' && detail.trim() ? detail : null;
}
