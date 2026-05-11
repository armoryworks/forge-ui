import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateService } from '@ngx-translate/core';
import { catchError, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface TerminologyEntry {
  key: string;
  label: string;
}

/**
 * Resolves terminology keys (entity_*, status_*, action_*, label_*) to
 * the user-facing string they should display.
 *
 * Resolution order (Pro Services rollout, Wave 13):
 *   1. Per-install terminology overrides loaded from `/api/v1/terminology`
 *      (populated by ApplyPresetHandler when a preset's TerminologyBundle
 *      is applied — e.g. PRESET-08 renames Job → Task, Customer → Client).
 *   2. ngx-translate fallback for the active locale, so Spanish users
 *      keep their localized labels on installs without a preset overlay.
 *      Without this, switching from `| translate` to `| terminology`
 *      would regress es.json users to humanized English.
 *   3. Humanize the key (strip prefix + title-case) as last resort.
 *
 * This three-tier resolution makes templates safe to migrate from
 * `| translate` to `| terminology` on multi-locale installs.
 */
@Injectable({ providedIn: 'root' })
export class TerminologyService {
  private readonly http = inject(HttpClient);
  // Optional so tests that don't import TranslateModule still construct
  // the service successfully. resolve() guards against null.
  private readonly translate = inject(TranslateService, { optional: true });
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
   * Resolve a terminology key to its display label. Walks the three-tier
   * resolution order (preset override → ngx-translate → humanize).
   */
  resolve(key: string): string {
    // Tier 1: per-install override
    const labels = this._labels();
    const override = labels.get(key);
    if (override !== undefined) return override;

    // Tier 2: ngx-translate fallback. `instant()` returns the key
    // verbatim when no translation is found, so check for that and fall
    // through to humanize when ngx-translate doesn't know the key.
    if (this.translate !== null) {
      try {
        const translated = this.translate.instant(key);
        if (typeof translated === 'string' && translated !== key && translated.length > 0) {
          return translated;
        }
      } catch {
        // TranslateService can throw if its loader isn't initialized yet;
        // ignore and fall through to humanize.
      }
    }

    // Tier 3: humanize the key
    return this.humanize(key);
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
