import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { LedgerViewComponent } from './ledger-view.component';
import { GeneralLedgerService } from '../../services/general-ledger.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import {
  JournalEntryExplanation,
  LedgerRegisterEntry,
  LedgerRegisterPage,
} from '../../models/accounting.models';

const ENTRY: LedgerRegisterEntry = {
  id: 1,
  entryNumber: 1,
  entryDate: '2026-01-10',
  source: 'Manual',
  sourceType: null,
  sourceId: null,
  status: 'Posted',
  memo: 'first',
  reversalOfEntryId: null,
  reversedByEntryId: null,
  postedAt: null,
  lines: [],
};

const PAGE: LedgerRegisterPage = { data: [ENTRY], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 };

interface ExplainState {
  loading: boolean;
  result: JournalEntryExplanation | null;
  failed: boolean;
}

interface LedgerApi {
  ngOnInit(): void;
  loading(): boolean;
  error(): string | null;
  entries(): (LedgerRegisterEntry & { entryDateDisplay: string })[];
  explanations(): Record<number, ExplainState>;
  explain(entry: LedgerRegisterEntry): void;
  scanAnomalies(): void;
  anomalyFlags(): Record<number, string[]>;
  anomalyCount(): number;
  reverseEntry(entry: LedgerRegisterEntry): void;
}

describe('LedgerViewComponent', () => {
  const gl = { getLedgerRegister: vi.fn(), explainJournalEntry: vi.fn(), getGlAnomalies: vi.fn(), reverseJournalEntry: vi.fn() };
  const snackbar = { error: vi.fn(), success: vi.fn() };
  const dialog = { open: vi.fn() };

  function create(): LedgerApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GeneralLedgerService, useValue: gl },
        { provide: SnackbarService, useValue: snackbar },
        { provide: MatDialog, useValue: dialog },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    // Empty the template so the heavy child components (data-table, etc.) don't render — we're
    // exercising the component's data/advisory logic, not its markup.
    TestBed.overrideComponent(LedgerViewComponent, { set: { template: '', imports: [], styles: [] } });
    const component = TestBed.createComponent(LedgerViewComponent).componentInstance as unknown as LedgerApi;
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    gl.getLedgerRegister.mockReturnValue(of(PAGE));
    gl.explainJournalEntry.mockReturnValue(
      of<JournalEntryExplanation>({ entryId: 1, explanation: 'A $100 cash sale.', aiAvailable: true, deterministicSummary: 'd' }),
    );
    gl.getGlAnomalies.mockReturnValue(of([]));
    gl.reverseJournalEntry.mockReturnValue(
      of({ id: 99, bookId: 1, entryNumber: 12, entryDate: '2026-02-01', status: 'Posted', memo: 'r' }),
    );
    dialog.open.mockReturnValue({ afterClosed: () => of({ reversalDate: '2026-02-01', reason: 'wrong account' }) });
  });

  it('loads the register for the default book on init', () => {
    const api = create();
    expect(gl.getLedgerRegister).toHaveBeenCalledWith(1, { pageSize: 100 });
    expect(api.entries()).toHaveLength(1);
    expect(api.loading()).toBe(false);
    expect(api.error()).toBeNull();
  });

  it('formats the DateOnly entry date as a plain string (no timezone shift)', () => {
    const api = create();
    // "2026-01-10" must render 01/10/2026 — never TZ-shifted to the previous day.
    expect(api.entries()[0].entryDateDisplay).toBe('01/10/2026');
  });

  it('scans for anomalies and indexes the flags by entry', () => {
    gl.getGlAnomalies.mockReturnValue(
      of([{ entryId: 1, entryNumber: 1, entryDate: '2026-01-10', source: 'Manual', totalDebit: 100, flags: ['big'] }]),
    );
    const api = create();
    api.scanAnomalies();
    expect(gl.getGlAnomalies).toHaveBeenCalledWith(1);
    expect(api.anomalyCount()).toBe(1);
    expect(api.anomalyFlags()[1]).toEqual(['big']);
  });

  it('reverses an entry via the dialog result, then reloads', () => {
    const api = create();
    api.reverseEntry(ENTRY);
    expect(dialog.open).toHaveBeenCalled();
    expect(gl.reverseJournalEntry).toHaveBeenCalledWith(1, { reversalDate: '2026-02-01', reason: 'wrong account' });
    expect(snackbar.success).toHaveBeenCalled();
    expect(gl.getLedgerRegister).toHaveBeenCalledTimes(2); // initial load + reload after reverse
  });

  it('surfaces an error when the load fails', () => {
    gl.getLedgerRegister.mockReturnValue(throwError(() => new Error('boom')));
    const api = create();
    expect(api.error()).toBe('accounting.errors.ledgerLoadFailed');
    expect(api.loading()).toBe(false);
  });

  it('fills in the AI explanation for an entry', () => {
    const api = create();
    api.explain(ENTRY);
    expect(gl.explainJournalEntry).toHaveBeenCalledWith(1, 1);
    expect(api.explanations()[1].result?.explanation).toBe('A $100 cash sale.');
    expect(api.explanations()[1].loading).toBe(false);
  });

  it('flags a failed explanation without throwing', () => {
    const api = create();
    gl.explainJournalEntry.mockReturnValue(throwError(() => new Error('offline')));
    api.explain(ENTRY);
    expect(api.explanations()[1].failed).toBe(true);
    expect(api.explanations()[1].result).toBeNull();
  });
});
