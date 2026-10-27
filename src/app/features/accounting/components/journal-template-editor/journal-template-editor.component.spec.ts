import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../../../environments/environment';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { JournalTemplate } from '../../models/journal-template.model';
import { JournalTemplateEditorComponent } from './journal-template-editor.component';

type Internals = {
  ngOnInit(): void;
  form: FormGroup;
  lineInfo(): { isControl: boolean; keyLabel: string | null; partyName: string }[];
  totals(): { debit: number; credit: number; open: number };
  addLine(): void;
  save(): void;
};

const api = `${environment.apiUrl}/accounting`;
const ACCOUNTS = [
  { id: 100, accountNumber: '10100', name: 'Cash', accountType: 'Asset', normalBalance: 'Debit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
  { id: 200, accountNumber: '20000', name: 'AP', accountType: 'Liability', normalBalance: 'Credit', isPostable: true, isControlAccount: true, requiresJob: false, requiresCostCenter: false },
  { id: 610, accountNumber: '61000', name: 'Rent', accountType: 'Expense', normalBalance: 'Debit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
];
const RULES = [{ key: 'CASH', glAccountId: 100, accountNumber: '10100', accountName: 'Cash', configurable: true, requiredAccountType: null }];
const TEMPLATE: JournalTemplate = {
  id: 3, bookId: 1, name: 'Rent', description: null, memo: 'Monthly rent', autoReverseNextPeriod: false, isActive: true,
  lines: [
    { accountDeterminationKey: null, glAccountId: 610, debit: 1200, credit: 0, description: 'Rent', partyType: null, partyId: null },
    { accountDeterminationKey: null, glAccountId: 200, debit: 0, credit: 1200, description: null, partyType: 'Vendor', partyId: 12 },
  ],
};

describe('JournalTemplateEditorComponent', () => {
  let http: HttpTestingController;
  let id: string | null;
  const router = { navigate: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    id = null;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: SnackbarService, useValue: { success: vi.fn(), errorFrom: vi.fn() } },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
              get paramMap() { return convertToParamMap(id ? { id } : {}); },
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function create(): Internals {
    const c = TestBed.runInInjectionContext(() => new JournalTemplateEditorComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${api}/accounts`).flush(ACCOUNTS);
    http.expectOne((r) => r.url === `${api}/gl/determination-rules`).flush(RULES);
    return c;
  }

  function lines(c: Internals): FormArray<FormGroup> {
    return c.form.get('lines') as FormArray<FormGroup>;
  }

  it('creates a balanced template with a line left open for the amount at posting', () => {
    const c = create();
    c.form.patchValue({ name: 'Utilities', memo: 'Utilities accrual' });
    lines(c).at(0).patchValue({ glAccountId: 610 });
    lines(c).at(1).patchValue({ glAccountId: 100 });
    expect(c.totals().open).toBe(2);
    expect(c.form.valid).toBe(true);

    c.save();

    const req = http.expectOne(`${api}/journal-templates`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(expect.objectContaining({ bookId: 1, name: 'Utilities', memo: 'Utilities accrual' }));
    expect(req.request.body.lines).toEqual([
      expect.objectContaining({ glAccountId: 610, debit: 0, credit: 0, partyType: null }),
      expect.objectContaining({ glAccountId: 100, debit: 0, credit: 0 }),
    ]);
    req.flush({ ...TEMPLATE, id: 9, name: 'Utilities' });
    expect(router.navigate).toHaveBeenCalledWith(['/accounting/journal-templates']);
  });

  it('refuses a fully-amounted template that does not balance', () => {
    const c = create();
    c.form.patchValue({ name: 'Bad' });
    lines(c).at(0).patchValue({ glAccountId: 610, debit: 100 });
    lines(c).at(1).patchValue({ glAccountId: 100, credit: 90 });

    expect(c.form.errors?.['unbalanced']).toBeTruthy();
    c.save();
    http.expectNone(`${api}/journal-templates`);
  });

  it('requires a counterparty on a control-account line', () => {
    const c = create();
    c.form.patchValue({ name: 'Supplier fee' });
    lines(c).at(0).patchValue({ glAccountId: 610, debit: 50 });
    lines(c).at(1).patchValue({ glAccountId: 200, credit: 50 });

    expect(c.lineInfo()[1].isControl).toBe(true);
    expect(c.form.errors?.['partyRequired']).toBeTruthy();
    lines(c).at(1).patchValue({ partyType: 'Vendor' });
    lines(c).at(1).patchValue({ partyId: 12 });
    expect(c.form.valid).toBe(true);
  });

  it('loads an existing template, resolves its counterparty name and saves with a PUT', () => {
    id = '3';
    const c = TestBed.runInInjectionContext(() => new JournalTemplateEditorComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${api}/accounts`).flush(ACCOUNTS);
    http.expectOne((r) => r.url === `${api}/gl/determination-rules`).flush(RULES);
    http.expectOne(`${api}/journal-templates/3`).flush(TEMPLATE);
    http.expectOne(`${api}/journal-templates/parties?partyType=Vendor&id=12`).flush([{ partyType: 'Vendor', id: 12, name: 'Steel Depot' }]);

    expect(c.form.get('name')!.value).toBe('Rent');
    expect(c.lineInfo()[1].partyName).toBe('Steel Depot');

    c.form.patchValue({ isActive: false });
    c.save();

    const req = http.expectOne(`${api}/journal-templates/3`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body.isActive).toBe(false);
    expect(req.request.body.lines[1]).toEqual(expect.objectContaining({ glAccountId: 200, partyType: 'Vendor', partyId: 12 }));
    req.flush(TEMPLATE);
  });

  it('keeps a determination-key line on its key', () => {
    id = '3';
    const c = TestBed.runInInjectionContext(() => new JournalTemplateEditorComponent()) as unknown as Internals;
    c.ngOnInit();
    http.expectOne((r) => r.url === `${api}/accounts`).flush(ACCOUNTS);
    http.expectOne((r) => r.url === `${api}/gl/determination-rules`).flush(RULES);
    http.expectOne(`${api}/journal-templates/3`).flush({
      ...TEMPLATE,
      lines: [TEMPLATE.lines[0], { ...TEMPLATE.lines[1], glAccountId: null, accountDeterminationKey: 'CASH', partyType: null, partyId: null }],
    });

    expect(c.lineInfo()[1].keyLabel).toContain('CASH');
    c.save();

    const req = http.expectOne(`${api}/journal-templates/3`);
    expect(req.request.body.lines[1]).toEqual(expect.objectContaining({ accountDeterminationKey: 'CASH', glAccountId: null }));
    req.flush(TEMPLATE);
  });
});
