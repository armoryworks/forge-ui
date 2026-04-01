import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

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
