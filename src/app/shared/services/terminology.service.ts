import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TerminologyEntry {
  key: string;
  label: string;
}

@Injectable({ providedIn: 'root' })
export class TerminologyService {
  private readonly http = inject(HttpClient);
  private readonly _labels = signal<Map<string, string>>(new Map());
  private loaded = false;

  readonly labels = this._labels.asReadonly();

  /**
   * Load terminology labels from the API. Call on app init (after auth).
   * Falls back to empty map if API is unavailable.
   */
  load(): void {
    if (this.loaded) return;

    this.http.get<TerminologyEntry[]>(`${environment.apiUrl}/terminology`).pipe(
      tap(entries => {
        const map = new Map<string, string>();
        for (const entry of entries) {
          map.set(entry.key, entry.label);
        }
        this._labels.set(map);
        this.loaded = true;
      }),
      catchError(() => {
        this.loaded = true;
        return of([]);
      }),
    ).subscribe();
  }

  /**
   * Resolve a terminology key to its display label.
   * Falls back to a humanized version of the key if not found.
   */
  resolve(key: string): string {
    const labels = this._labels();
    return labels.get(key) ?? this.humanize(key);
  }

  /**
   * Update a single label (for admin live preview).
   */
  set(key: string, label: string): void {
    this._labels.update(map => {
      const updated = new Map(map);
      updated.set(key, label);
      return updated;
    });
  }

  /**
   * Convert internal key to human-readable fallback.
   * e.g., 'entity_job' → 'Job', 'status_in_production' → 'In Production'
   */
  private humanize(key: string): string {
    return key
      .replace(/^(entity_|status_|action_|label_)/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
