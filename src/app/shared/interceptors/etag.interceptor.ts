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
 * Resource key = HTTP path (e.g. "/api/v1/jobs/179"). The cache is in-memory
 * only; on full reload, the next GET will refresh the ETag automatically.
 *
 * Master-data resources (customers, parts, vendors, etc.) are NOT subject to
 * ETag plumbing — the server simply ignores If-Match on them. Per the
 * Phase 1F decision: master data is last-write-wins. The interceptor still
 * harmlessly attaches If-Match if it has one, but the server treats it as
 * a no-op for those endpoints.
 *
 * On 412 Precondition Failed responses, the ConcurrencyConflictService is
 * notified so the UI can prompt the user to reload.
 *
 * Cases: CONC-OPTIMISTIC-LOCK-001.
 */
export const etagInterceptor: HttpInterceptorFn = (req, next) => {
  const cache = inject(ETagCacheService);
  const conflict = inject(ConcurrencyConflictService);

  // Build a stable cache key from the URL path (strip query string).
  const key = resourceKey(req.url);

  // Inject If-Match for mutating requests if we have a cached value.
  let outbound: HttpRequest<unknown> = req;
  if (key && (req.method === 'PATCH' || req.method === 'PUT' || req.method === 'DELETE')) {
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
            const rvKey = bodyResourceKey(req.url, resp, body);
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

function resourceKey(url: string): string | null {
  if (!url) return null;
  // Strip query string + protocol.
  const noQuery = url.split('?')[0];
  // For absolute URLs, strip host portion.
  try {
    const u = new URL(noQuery, 'http://placeholder.local');
    return u.pathname;
  } catch {
    return noQuery;
  }
}

/**
 * On a POST that creates a resource, the response body's id can be appended
 * to the request URL to form the canonical resource key for future
 * PATCH/PUT/DELETE.
 */
function bodyResourceKey(
  reqUrl: string,
  resp: HttpResponse<unknown>,
  body: { id?: number },
): string | null {
  const base = resourceKey(reqUrl);
  if (!base) return null;
  // If the URL already ends with /<id> or /<id>/something, just use it.
  if (/\/\d+(\/.*)?$/.test(base)) return base;
  if (typeof body.id === 'number' && body.id > 0) {
    const sep = base.endsWith('/') ? '' : '/';
    return `${base}${sep}${body.id}`;
  }
  return base;
}
