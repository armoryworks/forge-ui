import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Router, provideRouter } from '@angular/router';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { I18nLabelsComponent } from './i18n-labels.component';
import { I18nLabelOverride } from '../models/i18n-label-override.model';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

/**
 * Internal shape — tests pierce private members to drive the component
 * without rendering the template. Same shape used by sibling admin panel
 * specs (bi-api-keys-panel).
 */
interface ComponentInternals {
  loadOverrides(): void;
  openEdit(row: unknown): void;
  save(): void;
  retryPending(): void;
  form: { patchValue(v: unknown): void; invalid: boolean };
  filteredRows: { (): { key: string; baseValue: string; overrideValue: string | null; overrideId: number | null; isPendingTranslation: boolean }[] };
  pendingCount: { (): number };
  searchControl: { setValue(v: string): void };
  loading: { (): boolean };
  showDialog: { (): boolean };
  saving: { (): boolean };
}

const base = `${environment.apiUrl}/i18n/overrides`;

const overridesFixture: I18nLabelOverride[] = [
  {
    id: 1, key: 'common.save', languageCode: 'en', value: 'Commit',
    isMachineTranslated: false, isPendingTranslation: false, sourceLanguageCode: null,
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 2, key: 'common.save', languageCode: 'es', value: 'Commit',
    isMachineTranslated: true, isPendingTranslation: true, sourceLanguageCode: 'en',
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z',
  },
];

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideAnimations(),
      provideRouter([]),
      provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
    ],
  });
  const component = TestBed.runInInjectionContext(() => new I18nLabelsComponent());
  const httpMock = TestBed.inject(HttpTestingController);
  // Constructor kicks off the overrides list; the en catalog fetch is
  // triggered by an effect, so flush it after change detection settles.
  const listReq = httpMock.expectOne(base);
  listReq.flush(overridesFixture);
  TestBed.flushEffects();
  const catalogReq = httpMock.expectOne('/assets/i18n/en.json');
  catalogReq.flush({ common: { save: 'Save', cancel: 'Cancel' }, nav: { dashboard: 'Dashboard' } });
  return { component: component as unknown as ComponentInternals, httpMock };
}

describe('I18nLabelsComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('joins the shipped catalog with overrides for the selected language', () => {
    const { component, httpMock } = setup();

    const rows = component.filteredRows();
    expect(rows).toHaveLength(3); // common.save, common.cancel, nav.dashboard
    const saveRow = rows.find((r) => r.key === 'common.save');
    expect(saveRow?.baseValue).toBe('Save');
    expect(saveRow?.overrideValue).toBe('Commit');
    expect(saveRow?.overrideId).toBe(1);
    const cancelRow = rows.find((r) => r.key === 'common.cancel');
    expect(cancelRow?.overrideValue).toBeNull();
    expect(component.loading()).toBe(false);
    httpMock.verify();
  });

  it('filters rows from the ?q= URL param (URL is the source of truth)', async () => {
    const { component, httpMock } = setup();

    await TestBed.inject(Router).navigate([], { queryParams: { q: 'Dashb' } });

    const rows = component.filteredRows();
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('nav.dashboard');
    httpMock.verify();
  });

  it('counts pending machine translations across all languages', () => {
    const { component, httpMock } = setup();

    expect(component.pendingCount()).toBe(1);
    httpMock.verify();
  });

  it('PUTs an upsert on save and reloads the override list', () => {
    const { component, httpMock } = setup();
    const row = component.filteredRows().find((r) => r.key === 'common.cancel');
    component.openEdit(row);
    expect(component.showDialog()).toBe(true);
    component.form.patchValue({ value: 'Dismiss', autoTranslate: true });

    component.save();

    const req = httpMock.expectOne(base);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      key: 'common.cancel',
      languageCode: 'en',
      value: 'Dismiss',
      translateToOtherLanguages: true,
    });
    req.flush({ overrides: [], translationsPending: false });

    // Save closes the dialog and reloads the list.
    expect(component.showDialog()).toBe(false);
    const reload = httpMock.expectOne(base);
    reload.flush(overridesFixture);
    // The merge-point service refreshes the active override map so edits go live.
    const activeReq = httpMock.expectOne(`${base}/active`);
    activeReq.flush({});
    httpMock.verify();
  });

  it('does not PUT while the override value is empty (required)', () => {
    const { component, httpMock } = setup();
    const row = component.filteredRows().find((r) => r.key === 'common.cancel');
    component.openEdit(row);
    component.form.patchValue({ value: '' });

    component.save();

    httpMock.expectNone(base);
    expect(component.saving()).toBe(false);
    httpMock.verify();
  });

  it('POSTs retry-pending and reloads', () => {
    const { component, httpMock } = setup();

    component.retryPending();

    const req = httpMock.expectOne(`${base}/retry-pending`);
    expect(req.request.method).toBe('POST');
    req.flush({ translatedCount: 1, stillPendingCount: 0 });
    const reload = httpMock.expectOne(base);
    reload.flush([]);
    const activeReq = httpMock.expectOne(`${base}/active`);
    activeReq.flush({});
    httpMock.verify();
  });
});
