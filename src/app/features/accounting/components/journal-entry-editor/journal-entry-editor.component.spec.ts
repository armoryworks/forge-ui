import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { FormArray, FormGroup } from '@angular/forms';

import { JournalEntryEditorComponent } from './journal-entry-editor.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { JournalTemplateService } from '../../services/journal-template.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

interface EditorApi {
  ngOnInit(): void;
  form: FormGroup;
  accountOptions(): { value: unknown; label: string }[];
  balanced(): boolean;
  totalDebit(): number;
  totalCredit(): number;
  addLine(): void;
  removeLine(index: number): void;
  save(): void;
  isDirty(): boolean;
}

const ACCOUNTS = [
  { id: 100, accountNumber: '1000', name: 'Cash', accountType: 'Asset', normalBalance: 'Debit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
  { id: 101, accountNumber: '4000', name: 'Revenue', accountType: 'Income', normalBalance: 'Credit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
];

describe('JournalEntryEditorComponent', () => {
  const gl = {
    getChartOfAccounts: vi.fn(), createManualJournalEntry: vi.fn(), getLedgerRegister: vi.fn(), resubmitJournalEntry: vi.fn(),
    getDeterminationRules: vi.fn(),
  };
  const templates = { get: vi.fn() };
  const router = { navigate: vi.fn() };
  const snackbar = { success: vi.fn(), error: vi.fn(), errorFrom: vi.fn(), info: vi.fn() };
  let queryParams: Record<string, string>;

  function create(): EditorApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GeneralLedgerService, useValue: gl },
        { provide: JournalTemplateService, useValue: templates },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: (k: string) => queryParams[k] ?? null } } },
        },
        { provide: SnackbarService, useValue: snackbar },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(JournalEntryEditorComponent, { set: { template: '', imports: [], styles: [] } });
    const api = TestBed.createComponent(JournalEntryEditorComponent).componentInstance as unknown as EditorApi;
    api.ngOnInit();
    return api;
  }

  function fillBalanced(api: EditorApi): void {
    const lines = api.form.get('lines') as FormArray;
    api.form.get('memo')!.setValue('cash sale');
    lines.at(0).patchValue({ glAccountId: 100, debit: 100, credit: 0 });
    lines.at(1).patchValue({ glAccountId: 101, debit: 0, credit: 100 });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    queryParams = {};
    gl.getChartOfAccounts.mockReturnValue(of(ACCOUNTS));
    gl.createManualJournalEntry.mockReturnValue(
      of({ id: 5, bookId: 1, entryNumber: 7, entryDate: '2026-01-10', status: 'Posted', memo: 'cash sale' }),
    );
    gl.getLedgerRegister.mockReturnValue(of({ data: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }));
    gl.resubmitJournalEntry.mockReturnValue(
      of({ id: 9, bookId: 1, entryNumber: 12, entryDate: '2026-07-06', status: 'PendingApproval', memo: 'Accrue rent' }),
    );
  });

  it('prefills a rejected draft from ?resubmitOf and resubmits it in place', () => {
    queryParams = { resubmitOf: '9' };
    gl.getLedgerRegister.mockReturnValue(
      of({
        data: [
          {
            id: 9, entryNumber: 12, entryDate: '2026-07-06', source: 'Manual', sourceType: null, sourceId: null,
            status: 'Draft', memo: 'Accrue rent — [Rejected] wrong period', reversalOfEntryId: null, reversedByEntryId: null, postedAt: null,
            lines: [
              { id: 1, lineNumber: 1, glAccountId: 100, accountNumber: '1000', accountName: 'Cash', debit: 50, credit: 0, description: null, jobId: null, costCenterId: null },
              { id: 2, lineNumber: 2, glAccountId: 101, accountNumber: '4000', accountName: 'Revenue', debit: 0, credit: 50, description: null, jobId: null, costCenterId: null },
            ],
          },
        ],
        page: 1, pageSize: 100, totalCount: 1, totalPages: 1,
      }),
    );
    const api = create();

    expect(gl.getLedgerRegister).toHaveBeenCalledWith(1, { pageSize: 100, status: 'Draft' });
    expect(api.form.get('memo')!.value).toBe('Accrue rent');
    expect((api.form.get('lines') as FormArray).at(0).value.debit).toBe(50);
    expect(api.isDirty()).toBe(true);

    api.save();

    expect(gl.resubmitJournalEntry).toHaveBeenCalledWith(9, expect.objectContaining({ memo: 'Accrue rent', entryDate: '2026-07-06' }));
    expect(gl.createManualJournalEntry).not.toHaveBeenCalled();
    expect(api.isDirty()).toBe(false);
  });

  it('prefills from ?fromTemplate, resolving key lines and carrying the counterparty, and posts through the normal path', () => {
    queryParams = { fromTemplate: '3' };
    gl.getDeterminationRules.mockReturnValue(of([{ key: 'REVENUE', glAccountId: 101, accountNumber: '4000', accountName: 'Revenue', configurable: true, requiredAccountType: null }]));
    templates.get.mockReturnValue(of({
      id: 3, bookId: 1, name: 'Monthly service fee', description: null, memo: 'Service fee', autoReverseNextPeriod: false, isActive: true,
      lines: [
        { accountDeterminationKey: null, glAccountId: 100, debit: 0, credit: 0, description: 'Billed', partyType: 'Customer', partyId: 21 },
        { accountDeterminationKey: 'REVENUE', glAccountId: null, debit: 0, credit: 250, description: null, partyType: null, partyId: null },
      ],
    }));
    const api = create();
    const lines = api.form.get('lines') as FormArray;

    expect(templates.get).toHaveBeenCalledWith(3);
    expect(api.form.get('memo')!.value).toBe('Service fee');
    expect(lines.at(1).value.glAccountId).toBe(101);
    expect(lines.at(1).value.credit).toBe(250);
    expect(lines.at(0).value.debit).toBeNull();
    expect(api.form.valid).toBe(false);

    lines.at(0).patchValue({ debit: 250 });
    api.save();

    expect(gl.createManualJournalEntry).toHaveBeenCalledWith(expect.objectContaining({
      memo: 'Service fee',
      lines: [
        expect.objectContaining({ glAccountId: 100, debit: 250, partyType: 'Customer', partyId: 21 }),
        expect.objectContaining({ glAccountId: 101, credit: 250 }),
      ],
    }));
  });

  it('sends no counterparty on a line that has none', () => {
    const api = create();
    fillBalanced(api);
    api.save();

    const request = gl.createManualJournalEntry.mock.calls[0][0] as { lines: Record<string, unknown>[] };
    expect(request.lines[0]).not.toHaveProperty('partyType');
  });

  it('rejects a negative amount on a line', () => {
    const api = create();
    fillBalanced(api);
    (api.form.get('lines') as FormArray).at(0).patchValue({ debit: -100, credit: 0 });
    (api.form.get('lines') as FormArray).at(1).patchValue({ debit: 0, credit: -100 });

    expect((api.form.get('lines') as FormArray).at(0).hasError('negativeAmount')).toBe(true);
    api.save();
    expect(gl.createManualJournalEntry).not.toHaveBeenCalled();
  });

  it('reports unsaved changes only after an edit', () => {
    const api = create();
    expect(api.isDirty()).toBe(false);
    api.addLine();
    expect(api.isDirty()).toBe(true);
  });

  it('prefills lines and memo from ?correctionOf', () => {
    queryParams = { correctionOf: '4' };
    gl.getLedgerRegister.mockReturnValue(
      of({
        data: [
          {
            id: 4, entryNumber: 4, entryDate: '2026-07-06', source: 'Manual', sourceType: null, sourceId: null,
            status: 'Reversed', memo: 'wrong', reversalOfEntryId: null, reversedByEntryId: 5, postedAt: null,
            lines: [
              { id: 1, lineNumber: 1, glAccountId: 100, accountNumber: '1000', accountName: 'Cash', debit: 95, credit: 0, description: 'cash', jobId: null, costCenterId: null },
              { id: 2, lineNumber: 2, glAccountId: 101, accountNumber: '4000', accountName: 'Revenue', debit: 0, credit: 95, description: null, jobId: null, costCenterId: null },
            ],
          },
        ],
        page: 1, pageSize: 100, totalCount: 1, totalPages: 1,
      }),
    );
    const api = create();
    const lines = api.form.get('lines') as FormArray;
    expect(lines.length).toBe(2);
    expect(lines.at(0).value.glAccountId).toBe(100);
    expect(lines.at(0).value.debit).toBe(95);
    expect(lines.at(1).value.credit).toBe(95);
    expect(api.form.get('memo')!.value).toBe('accounting.journalEditor.correctionMemo');
  });

  it('loads postable accounts into the picker on init', () => {
    const api = create();
    expect(gl.getChartOfAccounts).toHaveBeenCalledWith(1, true);
    expect(api.accountOptions()).toHaveLength(2);
    expect(api.accountOptions()[0].label).toContain('Cash');
  });

  it('is balanced only when debits equal credits and are > 0', () => {
    const api = create();
    expect(api.balanced()).toBe(false);
    fillBalanced(api);
    expect(api.totalDebit()).toBe(100);
    expect(api.totalCredit()).toBe(100);
    expect(api.balanced()).toBe(true);
  });

  it('does not post while the form is invalid', () => {
    const api = create();
    (api.form.get('lines') as FormArray).at(0).patchValue({ glAccountId: 100, debit: 100, credit: 0 });
    api.save();
    expect(gl.createManualJournalEntry).not.toHaveBeenCalled();
  });

  it('posts a balanced entry then navigates to the ledger', () => {
    const api = create();
    fillBalanced(api);
    api.save();
    expect(gl.createManualJournalEntry).toHaveBeenCalledTimes(1);
    expect(snackbar.success).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/accounting/ledger']);
  });

  it('sends an entry held for a second approver to the approvals list', () => {
    gl.createManualJournalEntry.mockReturnValue(
      of({ id: 6, bookId: 1, entryNumber: 8, entryDate: '2026-01-10', status: 'PendingApproval', memo: 'cash sale' }),
    );
    const api = create();
    fillBalanced(api);
    api.save();
    expect(snackbar.success).not.toHaveBeenCalled();
    expect(snackbar.info).toHaveBeenCalledWith('accounting.journalEditor.pendingApproval');
    expect(router.navigate).toHaveBeenCalledWith(['/accounting/journal-approvals']);
  });

  it('adds and removes lines but keeps a minimum pair', () => {
    const api = create();
    const lines = api.form.get('lines') as FormArray;
    expect(lines.length).toBe(2);
    api.addLine();
    expect(lines.length).toBe(3);
    api.removeLine(2);
    expect(lines.length).toBe(2);
    api.removeLine(0); // no-op at the minimum
    expect(lines.length).toBe(2);
  });
});
