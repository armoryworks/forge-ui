import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { OpeningOpenItemsComponent } from './opening-open-items.component';
import { OpeningOpenItemsService } from '../../services/opening-open-items.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { OpeningOpenItemsValidation } from '../../models/opening-open-items-validation.model';

interface PageApi {
  ngOnInit(): void;
  form: FormGroup;
  receivablesTotal(): number;
  payablesTotal(): number;
  receivablesDifference(): number | null;
  payablesDifference(): number | null;
  rowResults(): { partyName: string | null; messages: string[] }[];
  canPost(): boolean;
  check(): OpeningOpenItemsValidation | null;
  addRow(): void;
  loadCsv(text: string): void;
  runCheck(): void;
  post(): void;
  isDirty(): boolean;
}

const CLEAN: OpeningOpenItemsValidation = {
  alreadyPosted: false, receivablesTotal: 1500, payablesTotal: 450, errorCount: 0,
  rows: [
    { rowNumber: 1, partyId: 7, partyName: 'Acme Fabrication', errors: [] },
    { rowNumber: 2, partyId: 9, partyName: 'Steel Supply', errors: [] },
  ],
};

describe('OpeningOpenItemsComponent', () => {
  const service = { validate: vi.fn(), post: vi.fn() };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn() };

  function create(): PageApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: OpeningOpenItemsService, useValue: service },
        { provide: SnackbarService, useValue: snackbar },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(OpeningOpenItemsComponent, { set: { template: '', imports: [], styles: [] } });
    const api = TestBed.createComponent(OpeningOpenItemsComponent).componentInstance as unknown as PageApi;
    api.ngOnInit();
    return api;
  }

  function fill(api: PageApi): void {
    api.form.patchValue({ asOfDate: new Date(2026, 0, 1), receivablesControl: 1500, payablesControl: 450 });
    api.addRow();
    const rows = api.form.get('rows') as FormArray;
    rows.at(0).patchValue({ partyType: 'Customer', partyRef: 'CUST-0001', documentNumber: 'INV-1', amount: 1500 });
    rows.at(1).patchValue({ partyType: 'Vendor', partyRef: 'VEND-0001', amount: 450 });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    service.validate.mockReturnValue(of(CLEAN));
    service.post.mockReturnValue(of({ journalEntryId: 40, entryNumber: 12, totalDebit: 1500 }));
  });

  it('shows the tie-out difference against the legacy control balances', () => {
    const api = create();
    fill(api);
    expect(api.receivablesTotal()).toBe(1500);
    expect(api.payablesTotal()).toBe(450);
    expect(api.receivablesDifference()).toBe(0);
    api.form.patchValue({ receivablesControl: 1600 });
    expect(api.receivablesDifference()).toBe(-100);
    expect(api.payablesDifference()).toBe(0);
  });

  it('posts only after a clean check that ties out, with the party lines and the equity offset', () => {
    const api = create();
    fill(api);
    expect(api.canPost()).toBe(false);

    api.runCheck();
    expect(service.validate).toHaveBeenCalledWith(1, [
      expect.objectContaining({ partyType: 'Customer', partyRef: 'CUST-0001', documentNumber: 'INV-1', amount: 1500 }),
      expect.objectContaining({ partyType: 'Vendor', partyRef: 'VEND-0001', amount: 450 }),
    ]);
    expect(api.rowResults()[0].partyName).toBe('Acme Fabrication');
    expect(api.canPost()).toBe(true);

    api.post();
    expect(service.post).toHaveBeenCalledWith(1, '2026-01-01', [
      expect.objectContaining({ accountDeterminationKey: 'AR_CONTROL', debit: 1500, partyId: 7, documentNumber: 'INV-1' }),
      expect.objectContaining({ accountDeterminationKey: 'AP_CONTROL', credit: 450, partyId: 9 }),
      expect.objectContaining({ accountDeterminationKey: 'OPENING_BALANCE_EQUITY', credit: 1050 }),
    ]);
    expect(api.isDirty()).toBe(false);
    expect(api.canPost()).toBe(false);
  });

  it('will not post while the totals do not tie out or the check found problems', () => {
    const api = create();
    fill(api);
    api.form.patchValue({ payablesControl: 400 });
    api.runCheck();
    expect(api.canPost()).toBe(false);

    service.validate.mockReturnValue(of({ ...CLEAN, errorCount: 1, rows: [{ ...CLEAN.rows[0], partyId: null, partyName: null, errors: ['party-not-found'] }, CLEAN.rows[1]] }));
    api.form.patchValue({ payablesControl: 450 });
    api.runCheck();
    expect(api.rowResults()[0].messages).toEqual(['accounting.openItems.errors.party-not-found']);
    expect(api.canPost()).toBe(false);
  });

  it('forgets the check when a row changes', () => {
    const api = create();
    fill(api);
    api.runCheck();
    expect(api.check()).not.toBeNull();
    (api.form.get('rows') as FormArray).at(0).patchValue({ amount: 1499 });
    expect(api.check()).toBeNull();
  });

  it('loads rows from the CSV template and reports unreadable lines', () => {
    const api = create();
    api.loadCsv('partyType,party,documentNumber,documentDate,dueDate,amount,description\nCustomer,CUST-0001,INV-9,2025-12-01,2025-12-31,99.50,\nVendor,VEND-0001,,,,10,\n');
    expect((api.form.get('rows') as FormArray).length).toBe(2);
    expect(api.receivablesTotal()).toBe(99.5);

    api.loadCsv('partyType,party,documentNumber,documentDate,dueDate,amount,description\nBank,X,,,,1,\n');
    expect(snackbar.error).toHaveBeenCalledWith('accounting.openItems.csvBadRows');
  });
});
