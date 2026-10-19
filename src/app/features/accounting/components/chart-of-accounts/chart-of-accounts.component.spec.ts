import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { GlAccountAdmin } from '../../models/accounting.models';
import { ChartOfAccountsComponent } from './chart-of-accounts.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  form: FormGroup;
  openEdit(a: GlAccountAdmin): void;
  openCreate(): void;
  save(): void;
  contraBalance(): boolean;
};

const base = `${environment.apiUrl}/accounting`;

function account(overrides: Partial<GlAccountAdmin> = {}): GlAccountAdmin {
  return {
    id: 41, accountNumber: '41000', name: 'Sales Returns', accountType: 'Income', normalBalance: 'Debit',
    parentAccountId: null, isPostable: true, isControlAccount: false, isActive: true, requiresJob: false,
    requiresCostCenter: false, cashFlowCategory: null, description: null, hasPostings: false,
    ...overrides,
  };
}

describe('ChartOfAccountsComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(): Internals {
    return TestBed.runInInjectionContext(() => new ChartOfAccountsComponent()) as unknown as Internals;
  }

  it('keeps a contra account\'s stored normal balance when it is opened for edit', () => {
    const c = create();

    c.openEdit(account());

    expect(c.form.controls['accountType'].value).toBe('Income');
    expect(c.form.controls['normalBalance'].value).toBe('Debit');
    expect(c.contraBalance()).toBe(true);
  });

  it('defaults the normal balance to the type convention when the user picks a type', () => {
    const c = create();
    c.openCreate();
    const type = c.form.controls['accountType'];

    type.markAsDirty();
    type.setValue('Liability');

    expect(c.form.controls['normalBalance'].value).toBe('Credit');
    expect(c.contraBalance()).toBe(false);
  });

  it('does not send structural fields for an account with postings', () => {
    const c = create();
    c.openEdit(account({ hasPostings: true }));

    c.save();

    const req = http.expectOne((r) => r.method === 'PUT' && r.url.startsWith(`${base}/`));
    expect(req.request.body.accountNumber).toBeNull();
    expect(req.request.body.accountType).toBeNull();
    expect(req.request.body.normalBalance).toBeNull();
  });
});
