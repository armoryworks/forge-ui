import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DataImportResult } from '../../../../shared/models/data-import-result.model';
import { JobImportService } from '../../services/job-import.service';
import { JobImportRow } from '../../models/job-import-row.model';
import { JobImportPageComponent } from './job-import.component';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

type Internals = {
  rows(): JobImportRow[];
  parseErrors(): string[];
  result(): DataImportResult | null;
  canValidate(): boolean;
  canCommit(): boolean;
  load(text: string): void;
  validate(): void;
  commit(): void;
  displayRows(): { rowNumber: number; result: { status: string } | null }[];
};

const CSV = 'Job Number,Title,Customer,Part,Qty,Due Date,Stage,Customer PO\nJ-1001,Run 1,C-12,BRK-1,250,01/30/2026,In Production,PO-1\n,Run 2,Acme,BRK-1,5,2026-02-15,,\n';

function result(overrides: Partial<DataImportResult> = {}): DataImportResult {
  return {
    totalRows: 2, validCount: 2, invalidCount: 0, createdCount: 0, committed: false,
    rows: [
      { rowKey: 'r1', rowNumber: 1, status: 'Valid', errors: [], number: 'J-1001', createdId: null },
      { rowKey: 'r2', rowNumber: 2, status: 'Valid', errors: [], number: null, createdId: null },
    ],
    ...overrides,
  };
}

describe('JobImportPageComponent', () => {
  let validate: ReturnType<typeof vi.fn>;
  let commit: ReturnType<typeof vi.fn>;
  let success: ReturnType<typeof vi.fn>;

  function page(): Internals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: JobImportService, useValue: { validate, commit } },
        { provide: SnackbarService, useValue: { success } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new JobImportPageComponent()) as unknown as Internals;
  }

  beforeEach(() => {
    validate = vi.fn(() => of(result()));
    commit = vi.fn(() => of(result({ committed: true, createdCount: 2, rows: result().rows.map(r => ({ ...r, status: 'Created' as const })) })));
    success = vi.fn();
  });

  it('maps CSV columns and aliases onto import rows', () => {
    const p = page();

    p.load(CSV);

    expect(p.parseErrors()).toEqual([]);
    expect(p.rows()[0]).toMatchObject({
      rowKey: 'r1', jobNumber: 'J-1001', title: 'Run 1', customer: 'C-12', part: 'BRK-1', quantity: 250,
      dueDate: '2026-01-30T00:00:00Z', stage: 'In Production', customerPO: 'PO-1',
    });
    expect(p.rows()[1]).toMatchObject({ jobNumber: null, dueDate: '2026-02-15T00:00:00Z', stage: null });
  });

  it('reports unreadable dates and numbers before anything is sent', () => {
    const p = page();

    p.load('Title,Qty,Due Date\nRun,lots,someday\n');

    expect(p.parseErrors().length).toBe(2);
    expect(p.canValidate()).toBe(false);
  });

  it('validates, then commits only a clean dry run', () => {
    const p = page();
    p.load(CSV);
    expect(p.canCommit()).toBe(false);

    p.validate();
    expect(validate).toHaveBeenCalledWith(p.rows());
    expect(p.displayRows()[0].result?.status).toBe('Valid');
    expect(p.canCommit()).toBe(true);

    p.commit();
    expect(commit).toHaveBeenCalledWith(p.rows());
    expect(p.result()?.committed).toBe(true);
    expect(success).toHaveBeenCalledWith('jobImport.committed');
    expect(p.canCommit()).toBe(false);
  });

  it('keeps Import off while any row is invalid', () => {
    validate.mockReturnValue(of(result({
      validCount: 1, invalidCount: 1,
      rows: [
        { rowKey: 'r1', rowNumber: 1, status: 'Invalid', errors: ["Unknown customer 'C-12'."], number: 'J-1001', createdId: null },
        { rowKey: 'r2', rowNumber: 2, status: 'Valid', errors: [], number: null, createdId: null },
      ],
    })));
    const p = page();
    p.load(CSV);

    p.validate();

    expect(p.canCommit()).toBe(false);
    p.commit();
    expect(commit).not.toHaveBeenCalled();
  });
});
