import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';

import { BankStatementsComponent } from './bank-statements.component';
import { BankStatementService } from '../../services/bank-statement.service';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BankMatchDialogComponent } from '../bank-match-dialog/bank-match-dialog.component';
import { BankStatementLineModel } from '../../models/accounting.models';

interface PageApi {
  openMatch(line: BankStatementLineModel): void;
}

const LINE: BankStatementLineModel = { id: 5, postedDate: '2026-06-10', amount: 750, description: 'DEPOSIT', matchStatus: 'Unmatched', matchedJournalLineId: null, matchedEntryNumber: null, matchedEntryDate: null, matchedMemo: null, confirmedAt: null };

describe('BankStatementsComponent manual match', () => {
  const statements = { getImports: vi.fn() };
  const gl = { getCashAccounts: vi.fn() };
  const dialog = { open: vi.fn() };

  function create(): PageApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: BankStatementService, useValue: statements },
        { provide: GeneralLedgerService, useValue: gl },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    TestBed.overrideComponent(BankStatementsComponent, { set: { template: '', imports: [], styles: [] } });
    return TestBed.createComponent(BankStatementsComponent).componentInstance as unknown as PageApi;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    statements.getImports.mockReturnValue(of([]));
    gl.getCashAccounts.mockReturnValue(of([]));
  });

  it('opens the candidate picker for the line and reloads once it is matched', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of({ ...LINE, matchStatus: 'Confirmed' }) });
    const api = create();
    const loadsBefore = statements.getImports.mock.calls.length;

    api.openMatch(LINE);

    expect(dialog.open).toHaveBeenCalledWith(BankMatchDialogComponent, expect.objectContaining({ data: { line: LINE } }));
    expect(statements.getImports.mock.calls.length).toBe(loadsBefore + 1);
  });

  it('leaves the list alone when the picker is cancelled', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
    const api = create();
    const loadsBefore = statements.getImports.mock.calls.length;

    api.openMatch(LINE);

    expect(statements.getImports.mock.calls.length).toBe(loadsBefore);
  });
});
