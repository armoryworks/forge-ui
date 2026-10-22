import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BulkPartIntakeResponse, BulkPartIntakeRow, BulkPartIntakeRowStatus } from '../../models/bulk-part-intake.model';
import { PartsService } from '../../services/parts.service';
import { PartImportPageComponent } from './part-import.component';

interface ImportHarness {
  pasteControl: { setValue(value: string): void };
  parsedRows: () => BulkPartIntakeRow[];
  parseErrors: () => string[];
  committed: () => boolean;
  canCommit: () => boolean;
  onPasteParse(): void;
  runPreview(): void;
  commit(): void;
  statusLabel(status: BulkPartIntakeRowStatus): string;
}

describe('PartImportPageComponent', () => {
  let partsService: { bulkIntakePreview: ReturnType<typeof vi.fn>; bulkIntakeCommit: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  const response = (createdPartId: number | null): BulkPartIntakeResponse => ({
    totalRows: 1, createdCount: 1, skippedCount: 0,
    results: [{ externalRowKey: 'r1', status: 'Created', createdPartId, createdPartNumber: 'PRT-00001', matchedPartId: null, message: null }],
  });

  beforeEach(() => {
    vi.useFakeTimers();
    partsService = {
      bulkIntakePreview: vi.fn(() => of(response(null))),
      bulkIntakeCommit: vi.fn(() => of(response(5))),
    };
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    TestBed.configureTestingModule({
      providers: [
        { provide: PartsService, useValue: partsService },
        { provide: Router, useValue: router },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  function create(): ImportHarness {
    return TestBed.runInInjectionContext(() => new PartImportPageComponent()) as unknown as ImportHarness;
  }

  function parse(page: ImportHarness, text: string): void {
    page.pasteControl.setValue(text);
    page.onPasteParse();
  }

  it('keeps rows that have data but no name so the server can flag them, and drops fully blank rows', () => {
    const page = create();

    parse(page, 'name,description,part number\nBracket,steel,B-1\n,empty name row,\n   ,whitespace name,\n , ,\n');

    expect(page.parsedRows().map(r => r.name)).toEqual(['Bracket', '', '']);
    expect(page.parsedRows()[1].description).toBe('empty name row');
    expect(page.parseErrors()).toEqual([]);
  });

  it('reports a header-only paste instead of doing nothing', () => {
    const page = create();

    parse(page, 'name,description\n');

    expect(page.parsedRows()).toEqual([]);
    expect(page.parseErrors()).toEqual(['parts.importPage.noDataRows']);
  });

  it('stays on the page after commit and labels the created rows as created', () => {
    const page = create();
    parse(page, 'name\nBracket\n');
    page.runPreview();
    expect(page.statusLabel('Created')).toBe('parts.importPage.status.Created');

    page.commit();
    vi.advanceTimersByTime(5000);

    expect(router.navigate).not.toHaveBeenCalled();
    expect(page.committed()).toBe(true);
    expect(page.canCommit()).toBe(false);
    expect(page.statusLabel('Created')).toBe('parts.importPage.importedStatus');
  });
});
