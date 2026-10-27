import { describe, expect, it, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { AccountingService } from '../../shared/services/accounting.service';
import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { CurrencyCatalogService } from '../../shared/services/currency-catalog.service';
import { CurrencyService } from '../../shared/services/currency.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { InvoiceService } from './services/invoice.service';
import { InvoicesComponent } from './invoices.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('InvoicesComponent · historical import link', () => {
  function canImport(roles: string[], opts: { standalone?: boolean; fileImport?: boolean } = {}): boolean {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: InvoiceService, useValue: { getInvoicesPaged: () => of({ items: [], totalCount: 0 }), getUninvoicedJobs: () => of([]) } },
        { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null, open: vi.fn() } },
        { provide: DraftResumeService, useValue: { consume: () => false } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: AccountingService, useValue: { isStandalone: signal(opts.standalone ?? true), providerName: signal(null) } },
        { provide: CurrencyCatalogService, useValue: { ensureLoaded() { return this; } } },
        { provide: CurrencyService, useValue: { baseCurrency: signal(null) } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn() } },
        { provide: AuthService, useValue: { hasAnyRole: (wanted: string[]) => wanted.some(r => roles.includes(r)) } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => code !== 'CAP-CROSS-INTEG-FILE' || (opts.fileImport ?? true) } },
      ],
    });
    const component = TestBed.runInInjectionContext(() => new InvoicesComponent()) as unknown as { canImportInvoices(): boolean };
    return component.canImportInvoices();
  }

  it('offers the import to the billing roles in standalone accounting', () => {
    expect(canImport(['OfficeManager'])).toBe(true);
    expect(canImport(['Admin'])).toBe(true);
  });

  it('hides it from other roles, under external accounting, and when file import is off', () => {
    expect(canImport(['PM'])).toBe(false);
    expect(canImport(['Admin'], { standalone: false })).toBe(false);
    expect(canImport(['Admin'], { fileImport: false })).toBe(false);
  });
});
