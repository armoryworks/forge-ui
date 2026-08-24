import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { EntityPreview } from '../models/entity-preview.model';

/**
 * Fetches the lightweight hover-preview for a linked record.
 *
 * Results are cached in-memory keyed `type:id` (via shareReplay) so repeated
 * hovers over the same link don't refetch. A 404/error resolves to `null`
 * rather than throwing — the link itself keeps working, the popover just
 * shows nothing.
 */
@Injectable({ providedIn: 'root' })
export class EntityPreviewService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<EntityPreview | null>>();

  getPreview(type: string, id: number): Observable<EntityPreview | null> {
    const key = `${type}:${id}`;
    let cached = this.cache.get(key);
    if (!cached) {
      cached = this.http
        .get<EntityPreview>(`${environment.apiUrl}/entity-preview/${type}/${id}`)
        .pipe(
          catchError(() => of(null)),
          shareReplay(1),
        );
      this.cache.set(key, cached);
    }
    return cached;
  }
}
