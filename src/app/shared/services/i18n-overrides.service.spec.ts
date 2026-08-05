import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';

import { TranslateLoader, TranslateService, TranslationObject, provideTranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { I18nOverridesService } from './i18n-overrides.service';

/** Stands in for the HTTP catalog loader — the shipped JSON the overrides merge over. */
class CatalogStubLoader implements TranslateLoader {
  getTranslation(): Observable<TranslationObject> {
    return of({ common: { save: 'Save', cancel: 'Cancel' } });
  }
}

const activeUrl = `${environment.apiUrl}/i18n/overrides/active`;

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: CatalogStubLoader } }),
    ],
  });
  const translate = TestBed.inject(TranslateService);
  translate.use('en');
  const service = TestBed.inject(I18nOverridesService);
  const httpMock = TestBed.inject(HttpTestingController);
  return { service, translate, httpMock };
}

describe('I18nOverridesService (merge point)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('layers fetched overrides over the shipped catalog via setTranslation merge', () => {
    const { service, translate, httpMock } = setup();

    service.load();
    httpMock.expectOne(activeUrl).flush({ en: { 'common.save': 'Commit' } });

    expect(translate.instant('common.save')).toBe('Commit'); // overridden
    expect(translate.instant('common.cancel')).toBe('Cancel'); // untouched shipped value
    httpMock.verify();
  });

  it('keeps the shipped catalog untouched when the override fetch fails', () => {
    const { service, translate, httpMock } = setup();

    service.load();
    httpMock.expectOne(activeUrl).flush(null, { status: 403, statusText: 'Forbidden' });

    expect(translate.instant('common.save')).toBe('Save');
    httpMock.verify();
  });

  it('re-applies cached overrides after a language switch replaces the catalog', () => {
    const { service, translate, httpMock } = setup();
    service.load();
    httpMock.expectOne(activeUrl).flush({
      en: { 'common.save': 'Commit' },
      es: { 'common.save': 'Confirmar' },
    });

    translate.use('es'); // CatalogStubLoader resolves synchronously; onLangChange re-applies.

    expect(translate.instant('common.save')).toBe('Confirmar');
    httpMock.verify();
  });
});
