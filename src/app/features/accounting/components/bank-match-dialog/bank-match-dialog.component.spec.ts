import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { BankMatchDialogComponent } from './bank-match-dialog.component';
import { BankStatementService } from '../../services/bank-statement.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BankMatchCandidate } from '../../models/bank-match-candidate.model';

interface DialogApi {
  ngOnInit(): void;
  candidates(): BankMatchCandidate[];
  selected(): BankMatchCandidate | null;
  select(c: BankMatchCandidate): void;
  widen(): void;
  confirm(): void;
}

const LINE = { id: 5, postedDate: '2026-06-10', amount: 750, description: 'DEPOSIT', matchStatus: 'Unmatched', matchedJournalLineId: null, matchedEntryNumber: null, matchedEntryDate: null, matchedMemo: null, confirmedAt: null };
const EXACT: BankMatchCandidate = { journalLineId: 41, journalEntryId: 9, entryNumber: 17, entryDate: '2026-06-12', amount: 750, memo: 'Deposit', description: null, source: 'AR', sourceType: 'Payment', daysApart: 2, amountDifference: 0 };

describe('BankMatchDialogComponent', () => {
  const statements = { getCandidates: vi.fn(), match: vi.fn() };
  const dialogRef = { close: vi.fn() };
  const snackbar = { success: vi.fn(), errorFrom: vi.fn() };

  function create(): DialogApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BankStatementService, useValue: statements },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { line: LINE } },
        { provide: SnackbarService, useValue: snackbar },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(BankMatchDialogComponent, { set: { template: '', imports: [], styles: [] } });
    const api = TestBed.createComponent(BankMatchDialogComponent).componentInstance as unknown as DialogApi;
    api.ngOnInit();
    return api;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    statements.getCandidates.mockReturnValue(of([EXACT]));
    statements.match.mockReturnValue(of({ ...LINE, matchStatus: 'Confirmed', matchedJournalLineId: 41 }));
  });

  it('loads the candidates for the statement line', () => {
    const api = create();
    expect(statements.getCandidates).toHaveBeenCalledWith(5, null);
    expect(api.candidates()).toEqual([EXACT]);
  });

  it('matches the picked candidate and closes with the updated line', () => {
    const api = create();
    api.confirm();
    expect(statements.match).not.toHaveBeenCalled();

    api.select(EXACT);
    api.confirm();
    expect(statements.match).toHaveBeenCalledWith(5, 41);
    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ matchStatus: 'Confirmed' }));
  });

  it('searches a wider window on request and clears the pick', () => {
    const api = create();
    api.select(EXACT);
    api.widen();
    expect(statements.getCandidates).toHaveBeenLastCalledWith(5, 120);
    expect(api.selected()).toBeNull();
  });
});
