import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

// Matches ISO 8601 date-time strings:
// 2026-04-06T12:00:00Z, 2026-04-06T12:00:00.000Z, 2026-04-06T12:00:00+00:00
// TODO: Revisit — consider a generic mapToType / model instantiation pattern
// for richer deserialization (custom logic per model, not just dates).
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function transformDates(obj: unknown): unknown {
  if (typeof obj === 'string' && ISO_DATE_REGEX.test(obj)) return new Date(obj);
  if (Array.isArray(obj)) return obj.map(transformDates);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, transformDates(v)])
    );
  }
  return obj;
}

export const dateTransformInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    map(event => event instanceof HttpResponse ? event.clone({ body: transformDates(event.body) }) : event)
  );
