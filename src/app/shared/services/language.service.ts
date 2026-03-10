import { Injectable, inject, signal } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

export type SupportedLanguage = 'en' | 'es';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly currentLanguage = signal<SupportedLanguage>('en');

  readonly availableLanguages: { code: SupportedLanguage; label: string }[] = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
  ];

  initialize(): void {
    const saved = localStorage.getItem('language') as SupportedLanguage | null;
    const lang = saved ?? 'en';
    this.setLanguage(lang);
  }

  setLanguage(lang: SupportedLanguage): void {
    this.translate.use(lang);
    this.currentLanguage.set(lang);
    localStorage.setItem('language', lang);
    document.documentElement.lang = lang;
  }
}
