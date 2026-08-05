import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';

import { TranslateService, TranslationObject } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { environment } from '../../../environments/environment';

/** language code → (dotted i18n key → override text). */
export type I18nOverrideMap = Record<string, Record<string, string>>;

/**
 * Tenant i18n label overrides — THE MERGE POINT of the override pipeline.
 *
 * The shipped catalogs load from `/assets/i18n/{lang}.json` via ngx-translate's
 * HTTP loader (app.config.ts). This service fetches the install's admin-defined
 * overrides from the API and layers them over the loaded catalog with
 * `TranslateService.setTranslation(lang, nested, true)` (deep merge). Because
 * `translate.use()` replaces a language's catalog on every switch, the service
 * re-applies the cached overrides on every `onLangChange`. No rebuild needed —
 * edits go live on the next `refresh()` / reload.
 *
 * Loaded after auth + capability descriptor resolve (app.component.ts); when
 * CAP-ADMIN-I18N is disabled or the call fails the app silently keeps the
 * shipped labels.
 */
@Injectable({ providedIn: 'root' })
export class I18nOverridesService {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly overrides = signal<I18nOverrideMap>({});

  constructor() {
    // translate.use() replaces the catalog — re-layer cached overrides after
    // every language switch completes.
    this.translate.onLangChange
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.apply(event.lang));
  }

  /** Fetches active overrides and applies them to the current language. */
  load(): void {
    this.http
      .get<I18nOverrideMap>(`${environment.apiUrl}/i18n/overrides/active`)
      .pipe(catchError(() => of({} as I18nOverrideMap)))
      .subscribe((map) => {
        this.overrides.set(map ?? {});
        this.apply(this.translate.currentLang || this.translate.getDefaultLang() || 'en');
      });
  }

  /** Re-fetch + re-apply — called by the admin editor so saves go live immediately. */
  refresh(): void {
    this.load();
  }

  private apply(lang: string): void {
    const flat = this.overrides()[lang];
    if (!flat || Object.keys(flat).length === 0) {
      return;
    }
    this.translate.setTranslation(lang, this.toNested(flat) as TranslationObject, true);
  }

  /** `{ 'a.b.c': 'x' }` → `{ a: { b: { c: 'x' } } }` so the deep merge only touches overridden leaves. */
  private toNested(flat: Record<string, string>): Record<string, unknown> {
    const root: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(flat)) {
      const segments = key.split('.');
      let node = root;
      for (let i = 0; i < segments.length - 1; i++) {
        const existing = node[segments[i]];
        if (typeof existing !== 'object' || existing === null) {
          node[segments[i]] = {};
        }
        node = node[segments[i]] as Record<string, unknown>;
      }
      node[segments[segments.length - 1]] = value;
    }
    return root;
  }
}
