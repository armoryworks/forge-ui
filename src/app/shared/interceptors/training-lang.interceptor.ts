import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { LanguageService } from '../services/language.service';

/**
 * Appends the active UI language as `?lang=` to training-content GET requests so the
 * API serves localized module / path content. English is the canonical base (the API
 * falls back to it when no translation exists), so `en` is left off.
 */
export const trainingLangInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method === 'GET' && req.url.includes('/training/') && !req.params.has('lang')) {
    const lang = inject(LanguageService).currentLanguage();
    if (lang && lang !== 'en') {
      req = req.clone({ params: req.params.set('lang', lang) });
    }
  }
  return next(req);
};
