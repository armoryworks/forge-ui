import { HttpErrorResponse } from '@angular/common/http';

/** A 404 stand-in for a link whose record id is malformed, so it shows the same not-found state as a missing record. */
export function notFoundError(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 404, statusText: 'Not Found' });
}
