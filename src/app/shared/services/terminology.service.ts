import { computed, inject, Injectable, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { TranslateLoader, TranslateService, TranslationObject } from '@ngx-translate/core';
import { catchError, from, Observable, of, switchMap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { I18nOverridesService } from './i18n-overrides.service';
import { TermEntry, TermSetStore } from '../terminology/term-set.store';
import { TerminologyTranslateLoader } from '../terminology/terminology-translate-loader';

export type TerminologyEntry = TermEntry;

/**
 * Install terminology — admin renames of core terms (Job → Work Order,
 * Customer → Client) applied to every label in the app.
 *
 * Overrides load from `/api/v1/terminology` (admin edits on the Terminology
 * tab, or a preset's TerminologyBundle). Keys follow the catalog in
 * `shared/terminology/term-catalog.ts`: `entity_<term>` (singular),
 * `label_<terms>` (plural), with a `:es` suffix for Spanish and
 * `gender_<term>:es` for Spanish article agreement.
 *
 * The rename happens once per language, not per render: the translate loader
 * keeps each shipped catalog and this service rebuilds the displayed catalog
 * whenever the term set changes (load, admin save, `terminologyChanged` hub
 * push), then re-layers the i18n label overrides on top so a specific label
 * override always beats a term rename.
 *
 * {@link resolve} keeps the older key-based lookup for the `| terminology`
 * pipe: per-install override → ngx-translate → humanized key.
 */
@Injectable({ providedIn: 'root' })
export class TerminologyService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(TermSetStore);
  private readonly translate = inject(TranslateService, { optional: true });
  private readonly injector = inject(Injector);
  private readonly loader = inject(TranslateLoader, { optional: true });
  private loaded = false;

  readonly labels = computed(() => this.store.entries());

  /**
   * Load terminology labels from the API. Call on app init (after auth).
   * Falls back to the cached set if the API is unavailable.
   */
  load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.fetch();
  }

  /** Re-fetch and re-apply — used after an admin save and on the `terminologyChanged` hub event. */
  refresh(): void {
    this.loaded = true;
    this.fetch();
  }

  /** Apply a saved term set without a round trip (the admin save response). */
  applyEntries(entries: readonly TerminologyEntry[]): void {
    if (!this.store.setEntries(entries)) return;
    if (this.store.hasTerms()) void this.store.loadEngine();
    this.recompose();
  }

  /** Substitute the active terms into free text that bypasses the i18n catalog (help tours, server-sent training steps). */
  substitute(text: string, lang?: string): string {
    return this.store.substituter(lang ?? this.currentLang())?.substitute(text) ?? text;
  }

  /** {@link substitute} over driver.js walkthrough steps (title + description), leaving every other step field as is. */
  substituteSteps<T extends { popover?: { title?: string; description?: string } }>(steps: readonly T[], lang?: string): T[] {
    return steps.map(step => step.popover
      ? {
        ...step,
        popover: {
          ...step.popover,
          ...(step.popover.title !== undefined ? { title: this.substitute(step.popover.title, lang) } : {}),
          ...(step.popover.description !== undefined ? { description: this.substitute(step.popover.description, lang) } : {}),
        },
      }
      : step);
  }

  /**
   * Resolve a terminology key to its display label. Walks the three-tier
   * resolution order (override → ngx-translate → humanize).
   */
  resolve(key: string): string {
    const lang = this.currentLang();
    const labels = this.store.entries();
    const override = lang === 'en' ? labels.get(key) : labels.get(`${key}:${lang}`);
    if (override !== undefined) return override;

    if (this.translate !== null) {
      try {
        const translated = this.translate.instant(key);
        if (typeof translated === 'string' && translated !== key && translated.length > 0) {
          return translated;
        }
      } catch {
        return this.humanize(key);
      }
    }

    return this.humanize(key);
  }

  private fetch(): void {
    this.http.get<TerminologyEntry[]>(`${environment.apiUrl}/terminology`).pipe(
      catchError(() => of(null)),
    ).subscribe(entries => {
      if (entries) this.applyEntries(entries);
    });
  }

  private recompose(): void {
    if (!this.translate || !(this.loader instanceof TerminologyTranslateLoader)) return;
    const translate = this.translate;
    const loader = this.loader;
    for (const lang of this.store.loadedLanguages()) {
      if (!translate.getLangs().includes(lang)) continue;
      const gate$: Observable<unknown> = this.store.needsGate(lang) && !this.store.hasPristine('en')
        ? loader.fetchPristine('en').pipe(catchError(() => of(null)))
        : of(null);
      gate$.pipe(switchMap(() => from(this.store.compose(lang)))).subscribe(composed => {
        if (!composed) return;
        translate.setTranslation(lang, composed as TranslationObject, false);
        this.injector.get(I18nOverridesService).reapply(lang);
      });
    }
  }

  private currentLang(): string {
    return this.translate?.getCurrentLang?.() || 'en';
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
