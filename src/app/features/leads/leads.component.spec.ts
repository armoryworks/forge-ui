import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
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
  let leadsService: {
    getLeads: () => Observable<unknown[]>;
    bulkAssignOwner: ReturnType<typeof vi.fn>;
    updateLead: ReturnType<typeof vi.fn>;
    getOwnerCandidates: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    // The add-account dialog returns a CreateAccountRequest payload; the
    // service then POSTs it and returns the created Account.
    dialogOpen = vi.fn(() => ({ afterClosed: () => of({ name: newAccount.name }) }));
    accountsCreate = vi.fn(() => of(newAccount));
    leadsService = {
      getLeads: () => of([]),
      bulkAssignOwner: vi.fn(() => of({ updated: 2 })),
      updateLead: vi.fn(() => of({})),
      getOwnerCandidates: vi.fn(() => of([{ id: 7, name: 'Owen Rep' }])),
    };

    TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        { provide: LeadsService, useValue: leadsService },
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

  it('pipeline search matches the lead number', () => {
    const internals = component as unknown as {
      leads: { set: (rows: unknown[]) => void };
      searchControl: { setValue: (v: string) => void };
      filteredLeads: () => { id: number }[];
    };
    internals.leads.set([
      { id: 1, companyName: 'Acme', contactName: null, email: null, leadNumber: 'LEAD-00001', status: 'New' },
      { id: 2, companyName: 'Globex', contactName: null, email: null, leadNumber: 'LEAD-00002', status: 'New' },
    ]);
    internals.searchControl.setValue('lead-00002');

    expect(internals.filteredLeads().map(l => l.id)).toEqual([2]);
  });

  it('puts a card back in its column when the drag-to-Lost dialog is cancelled', () => {
    const internals = component as unknown as {
      leads: { set: (rows: unknown[]) => void; (): { id: number; status: string }[] };
      onCardDrop: (event: unknown, status: string) => void;
      cancelLost: () => void;
      showLostDialog: () => boolean;
    };
    const lead = { id: 5, companyName: 'Acme', contactName: null, email: null, leadNumber: 'LEAD-00005', status: 'Quoting' };
    internals.leads.set([lead]);

    internals.onCardDrop({ previousContainer: {}, container: {}, item: { data: lead } }, 'Lost');
    expect(internals.leads()[0].status).toBe('Lost');
    expect(internals.showLostDialog()).toBe(true);

    internals.cancelLost();

    expect(internals.leads()[0].status).toBe('Quoting');
    expect(internals.showLostDialog()).toBe(false);
    expect(leadsService.updateLead).not.toHaveBeenCalled();
  });

  it('puts a card back when saving the drag-to-Lost reason fails', () => {
    const internals = component as unknown as {
      leads: { set: (rows: unknown[]) => void; (): { id: number; status: string }[] };
      onCardDrop: (event: unknown, status: string) => void;
      lostReasonControl: { setValue: (v: string) => void };
      confirmLost: () => void;
      showLostDialog: () => boolean;
    };
    const lead = { id: 6, companyName: 'Acme', contactName: null, email: null, leadNumber: 'LEAD-00006', status: 'Contacted' };
    internals.leads.set([lead]);
    leadsService.updateLead.mockReturnValueOnce(throwError(() => new Error('boom')));

    internals.onCardDrop({ previousContainer: {}, container: {}, item: { data: lead } }, 'Lost');
    internals.lostReasonControl.setValue('Went elsewhere');
    internals.confirmLost();

    expect(internals.leads()[0].status).toBe('Contacted');
    expect(internals.showLostDialog()).toBe(false);
  });

  describe('bulk assign', () => {
    type BulkInternals = {
      selectedLeads: { set: (rows: unknown[]) => void };
      bulkOwnerControl: { setValue: (v: number | null) => void };
      bulkAccountControl: { setValue: (v: number | null) => void };
      openBulkAssignDialog: () => void;
      confirmBulkAssign: () => void;
      bulkOwnerOptions: () => { value: unknown; label: string }[];
    };
    const selected = [{ id: 1, companyName: 'A' }, { id: 2, companyName: 'B' }];

    it('assigns the owner in one call and leaves the account alone', () => {
      const internals = component as unknown as BulkInternals;
      internals.selectedLeads.set(selected);
      internals.openBulkAssignDialog();
      expect(internals.bulkOwnerOptions().some(o => o.value === 7 && o.label === 'Owen Rep')).toBe(true);

      internals.bulkOwnerControl.setValue(7);
      internals.confirmBulkAssign();

      expect(leadsService.bulkAssignOwner).toHaveBeenCalledWith([1, 2], 7);
      expect(leadsService.updateLead).not.toHaveBeenCalled();
    });

    it('sets only the account when the owner is kept', () => {
      const internals = component as unknown as BulkInternals;
      internals.selectedLeads.set(selected);
      internals.openBulkAssignDialog();

      internals.bulkAccountControl.setValue(99);
      internals.confirmBulkAssign();

      expect(leadsService.bulkAssignOwner).not.toHaveBeenCalled();
      expect(leadsService.updateLead).toHaveBeenCalledWith(1, { accountId: 99 });
      expect(leadsService.updateLead).toHaveBeenCalledWith(2, { accountId: 99 });
    });
  });
});
