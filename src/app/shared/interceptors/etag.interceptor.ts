import { HttpInterceptorFn, HttpRequest, HttpResponse, HttpEventType } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs';

import { ConcurrencyConflictService } from '../services/concurrency-conflict.service';
import { ETagCacheService } from '../services/etag-cache.service';

/**
 * Phase 3 / WU-11 / TODO E1 — UI side of optimistic locking.
 *
 * Caches per-resource ETags from PATCH/PUT/POST/GET responses, and injects
 * If-Match on subsequent PATCH/PUT/DELETE requests for the same resource.
 *
 * Resource key = HTTP path up to its last numeric id, so an action on a
 * record shares the record's key: "/api/v1/jobs/179/stage" and
 * "/api/v1/jobs/179" are both "/api/v1/jobs/179", while
 * "/api/v1/jobs/179/operations/5" keeps its own key. A path with no numeric
 * id (e.g. /jobs/bulk/*) is used as is. A response body's rowVersion is filed
 * under the record key only when the body's id is that record's id. The cache
 * is in-memory only; on full reload, the next GET will refresh the ETag
 * automatically. A request that already carries If-Match keeps its own value.
 *
 * Most master-data resources (parts, etc.) are NOT subject to ETag plumbing —
 * the server simply ignores If-Match on them. Per the Phase 1F decision: master
 * data is last-write-wins. The interceptor still harmlessly attaches If-Match
 * if it has one, but the server treats it as a no-op for those endpoints. The
 * full-form editors for customers, vendors, units of measure, master schedules
 * and employee profiles are versioned: the customer and vendor reads cache the
 * version for the record's PUT/DELETE, while the unit-of-measure and profile
 * saves send If-Match explicitly (a list read is not cached, and the profile's
 * self route has no id in its path).
 *
 * Documented permissive exceptions (explicitly last-write-wins by eng-lead ruling):
 *  - /jobs/bulk/* — bulk stage/assign/priority/archive operations. No per-resource
 *    ETag array protocol exists; the server enforces outcome-idempotency via
 *    outbox deduplication instead.
 *  - /jobs/{id}/position — presentational board ordering only. Enforcing If-Match
 *    would require N GETs for an N-card column reorder (30 round-trips on a
 *    15-card board). No business/financial invariant depends on position.
 *    No If-Match is sent, but the job version in the response is still cached,
 *    since a reorder bumps it.
 *
 * On 412 Precondition Failed responses, the ConcurrencyConflictService is
 * notified so the UI can prompt the user to reload.
 *
 * Cases: CONC-OPTIMISTIC-LOCK-001.
 */
export const etagInterceptor: HttpInterceptorFn = (req, next) => {
  const cache = inject(ETagCacheService);
  const conflict = inject(ConcurrencyConflictService);

  const path = requestPath(req.url);
  const key = path === null ? null : recordKey(path);

  let outbound: HttpRequest<unknown> = req;
  if (key && path && !UNLOCKED_PATH.test(path)
    && (req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE')) {
    const etag = cache.get(key);
    if (etag && !req.headers.has('If-Match')) {
      outbound = req.clone({ setHeaders: { 'If-Match': etag } });
    }
  }

  return next(outbound).pipe(
    tap({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          const resp = event as HttpResponse<unknown>;
          // Cache ETag from response headers if present.
          const etag = resp.headers.get('ETag');
          if (etag && key) {
            cache.set(key, etag);
          }
          // Some endpoints embed rowVersion in the body — capture that too.
          const body = resp.body as { id?: number; rowVersion?: number | string } | null | undefined;
          if (body && typeof body === 'object' && body.rowVersion !== undefined && body.rowVersion !== null) {
            const rvKey = bodyResourceKey(req.url, body);
            if (rvKey) {
              cache.set(rvKey, `"${body.rowVersion}"`);
            }
          }
        }
      },
      error: (err) => {
        if (err && err.status === 412) {
          conflict.notify({
            resource: key,
            method: req.method,
            url: req.url,
          });
        }
      },
    }),
  );
};

const UNLOCKED_PATH = /\/jobs\/\d+\/position\/?$/;

function requestPath(url: string): string | null {
  if (!url) return null;
  const noQuery = url.split('?')[0];
  try {
    const u = new URL(noQuery, 'http://placeholder.local');
    return u.pathname;
  } catch {
    return noQuery;
  }
}

function lastIdIndex(segments: string[]): number {
  for (let i = segments.length - 1; i >= 0; i--) {
    if (/^\d+$/.test(segments[i])) return i;
  }
  return -1;
}

function recordKey(path: string): string {
  const segments = path.split('/');
  const idIndex = lastIdIndex(segments);
  return idIndex < 0 ? path : segments.slice(0, idIndex + 1).join('/');
}

/**
 * The key a response body's rowVersion is filed under. A path ending in an
 * id is the record itself. A path that carries an id followed by an action
 * (e.g. /jobs/20/stage) maps to the record when the body is that record,
 * and stays as is otherwise. On a POST that creates a resource, the
 * response body's id is appended to the request URL.
 */
function bodyResourceKey(reqUrl: string, body: { id?: number }): string | null {
  const base = requestPath(reqUrl);
  if (!base) return null;
  const segments = base.split('/');
  const idIndex = lastIdIndex(segments);
  if (idIndex === segments.length - 1) return base;
  if (idIndex >= 0) {
    return body.id === Number(segments[idIndex]) ? recordKey(base) : base;
  }
  if (typeof body.id === 'number' && body.id > 0) {
    const sep = base.endsWith('/') ? '' : '/';
    return `${base}${sep}${body.id}`;
  }
  return base;
}
