import { DOCUMENT, registerLocaleData } from '@angular/common';
import localeEsUs from '@angular/common/locales/es-US';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

export type SupportedLanguage = 'en' | 'es';

const INTL_LOCALES: Record<SupportedLanguage, string> = { en: 'en-US', es: 'es-US' };

const STORAGE_KEY = 'language';

/** The language saved on this browser, or `en` when none (or an unsupported one) is saved. */
export function storedLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'es' || saved === 'en' ? saved : 'en';
  } catch {
    return 'en';
  }
}

/**
 * LOCALE_ID factory: the Angular locale for the saved language (`en-US` or `es-US`), registering the
 * es-US locale data on first use. Spanish keeps US conventions (MM/dd/yyyy dates, `.` decimal, `$`)
 * and only changes the words. LOCALE_ID is fixed for the life of the page, which is why a language
 * switch reloads.
 */
export function localeIdForStoredLanguage(): string {
  const locale = INTL_LOCALES[storedLanguage()];
  if (locale === 'es-US') registerLocaleData(localeEsUs, 'es-US');
  return locale;
}

/** Reloads the page after a language switch so LOCALE_ID and every pipe pick up the new locale. */
export const LANGUAGE_RELOAD = new InjectionToken<() => void>('LANGUAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return () => view?.location.reload();
  },
});

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly reload = inject(LANGUAGE_RELOAD);

  readonly currentLanguage = signal<SupportedLanguage>('en');
  readonly intlLocale = computed(() => INTL_LOCALES[this.currentLanguage()]);

  readonly availableLanguages: { code: SupportedLanguage; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
  ];

  initialize(): void {
    this.apply(storedLanguage());
  }

  /** Switches the UI language: saves it, then reloads the page when it changed. */
  setLanguage(lang: SupportedLanguage): void {
    const changed = lang !== storedLanguage() || lang !== this.currentLanguage();
    this.apply(lang);
    if (changed) this.reload();
  }

  private apply(lang: SupportedLanguage): void {
    this.translate.use(lang);
    this.currentLanguage.set(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      return;
    }
  }
}
