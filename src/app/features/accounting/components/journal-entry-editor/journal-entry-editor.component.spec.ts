import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { FormArray, FormGroup } from '@angular/forms';

import { JournalEntryEditorComponent } from './journal-entry-editor.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
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
}

const ACCOUNTS = [
  { id: 100, accountNumber: '1000', name: 'Cash', accountType: 'Asset', normalBalance: 'Debit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
  { id: 101, accountNumber: '4000', name: 'Revenue', accountType: 'Income', normalBalance: 'Credit', isPostable: true, isControlAccount: false, requiresJob: false, requiresCostCenter: false },
];

describe('JournalEntryEditorComponent', () => {
  const gl = { getChartOfAccounts: vi.fn(), createManualJournalEntry: vi.fn() };
  const router = { navigate: vi.fn() };
  const snackbar = { success: vi.fn(), error: vi.fn() };

  function create(): EditorApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GeneralLedgerService, useValue: gl },
        { provide: Router, useValue: router },
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
    gl.getChartOfAccounts.mockReturnValue(of(ACCOUNTS));
    gl.createManualJournalEntry.mockReturnValue(
      of({ id: 5, bookId: 1, entryNumber: 7, entryDate: '2026-01-10', status: 'Posted', memo: 'cash sale' }),
    );
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
