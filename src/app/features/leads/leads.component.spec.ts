import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

import { LeadsComponent } from './leads.component';
import { LeadsService } from './services/leads.service';
import { AccountsService } from './services/accounts.service';
import { ReferenceDataService } from '../../shared/services/reference-data.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { Account } from './models/account.model';

/**
 * forge#3 — regression coverage for inline Account creation in the Leads
 * edit and bulk-assign flows: the newly created account must be appended to
 * the picker's option source AND auto-selected in the relevant control.
 */
describe('LeadsComponent — inline account creation (forge#2/#3)', () => {
  const newAccount = { id: 99, name: 'Acme Tooling' } as Account;
  let component: LeadsComponent;
  let dialogOpen: ReturnType<typeof vi.fn>;
  let accountsCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // The add-account dialog returns a CreateAccountRequest payload; the
    // service then POSTs it and returns the created Account.
    dialogOpen = vi.fn(() => ({ afterClosed: () => of({ name: newAccount.name }) }));
    accountsCreate = vi.fn(() => of(newAccount));

    TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        { provide: LeadsService, useValue: { getLeads: () => of([]) } },
        { provide: AccountsService, useValue: { create: accountsCreate, list: () => of([]) } },
        { provide: ReferenceDataService, useValue: { getAsOptions: () => of([]) } },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
        { provide: DetailDialogService, useValue: { getDetailFromUrl: () => null } },
        { provide: ScannerService, useValue: { setContext: vi.fn(), clearLastScan: vi.fn(), lastScan: () => null } },
        { provide: DraftResumeService, useValue: { consume: () => false } },
        { provide: MatDialog, useValue: { open: dialogOpen } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
      ],
    });

    // Stub the template — this spec exercises the component's class logic
    // (openNewAccount), not its (heavy, child-component-laden) rendering.
    TestBed.overrideComponent(LeadsComponent, { set: { template: '' } });
    component = TestBed.createComponent(LeadsComponent).componentInstance;
  });

  it('lead edit: appends the created account and selects it on the lead form', () => {
    (component as unknown as { openNewAccountForLead: () => void }).openNewAccountForLead();

    expect(accountsCreate).toHaveBeenCalledOnce();
    const accounts = (component as unknown as { accounts: () => Account[] }).accounts();
    expect(accounts.some(a => a.id === newAccount.id)).toBe(true);
    const form = (component as unknown as { leadForm: { get: (n: string) => { value: unknown } | null } }).leadForm;
    expect(form.get('accountId')!.value).toBe(newAccount.id);
  });

  it('bulk assign: appends the created account and selects it on the bulk control', () => {
    (component as unknown as { openNewAccountForBulk: () => void }).openNewAccountForBulk();

    expect(accountsCreate).toHaveBeenCalledOnce();
    const accounts = (component as unknown as { accounts: () => Account[] }).accounts();
    expect(accounts.some(a => a.id === newAccount.id)).toBe(true);
    const ctrl = (component as unknown as { bulkAccountControl: { value: unknown } }).bulkAccountControl;
    expect(ctrl.value).toBe(newAccount.id);
  });
});
