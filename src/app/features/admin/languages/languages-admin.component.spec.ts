import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService } from '@ngx-translate/core';

import { of, throwError } from 'rxjs';

import { I18nOverridesService } from '../../../shared/services/i18n-overrides.service';
import { LanguageService } from '../../../shared/services/language.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { TranslationTransferService } from '../services/translation-transfer.service';
import { TranslationImportPlan } from '../models/translation-import-plan.model';
import { LanguagesAdminComponent } from './languages-admin.component';

interface PageInternals {
  keyCount(): number;
  overrideCount(): number;
  plan(): TranslationImportPlan | null;
  unreadable(): boolean;
  preview(text: string, name: string): void;
  applyImport(): void;
}

describe('LanguagesAdminComponent', () => {
  const transfer = { load: vi.fn(), import: vi.fn() };
  const overrides = { refresh: vi.fn() };
  const snackbar = { success: vi.fn(), errorFrom: vi.fn() };

  function build(): PageInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: TranslationTransferService, useValue: transfer },
        { provide: I18nOverridesService, useValue: overrides },
        { provide: LanguageService, useValue: { availableLanguages: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }] } },
        { provide: SnackbarService, useValue: snackbar },
      ],
    });
    return TestBed.runInInjectionContext(() => new LanguagesAdminComponent()) as unknown as PageInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    transfer.load.mockReturnValue(of({ shipped: { 'a.b': 'Uno', 'a.c': 'Dos' }, overrides: { 'a.c': 'Otro' } }));
    transfer.import.mockReturnValue(of({ created: 1, updated: 0, reverted: 0, unchanged: 0 }));
  });

  it('loads the shipped catalog and the overrides for Spanish', () => {
    const page = build();

    expect(transfer.load).toHaveBeenCalledWith('es');
    expect(page.keyCount()).toBe(2);
    expect(page.overrideCount()).toBe(1);
  });

  it('previews an import and sends only the changed keys with their shipped text', () => {
    const page = build();

    page.preview('key,value\na.b,Primero\na.c,Otro\nz.z,X\n', 'es.csv');

    expect(page.plan()!.changes.map(c => c.key)).toEqual(['a.b']);
    expect(page.plan()!.unknownKeys).toEqual(['z.z']);
    page.applyImport();
    expect(transfer.import).toHaveBeenCalledWith('es', [expect.objectContaining({ key: 'a.b', newValue: 'Primero', shippedValue: 'Uno' })]);
    expect(overrides.refresh).toHaveBeenCalled();
  });

  it('flags a file it cannot read and sends nothing', () => {
    const page = build();

    page.preview('nonsense', 'x.csv');
    page.applyImport();

    expect(page.unreadable()).toBe(true);
    expect(transfer.import).not.toHaveBeenCalled();
  });

  it('shows nothing to export and reports the error when the catalog cannot load', () => {
    transfer.load.mockReturnValue(throwError(() => new Error('offline')));
    const page = build();

    page.preview('key,value\na.b,Primero\n', 'es.csv');
    page.applyImport();

    expect(page.keyCount()).toBe(0);
    expect(snackbar.errorFrom).toHaveBeenCalledWith(expect.any(Error), 'admin.languages.loadFailed');
    expect(transfer.import).not.toHaveBeenCalled();
  });
});
