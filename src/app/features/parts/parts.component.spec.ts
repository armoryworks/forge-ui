import { DestroyRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormGroup } from '@angular/forms';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ScanEvent } from '../../shared/models/scan-event.model';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { EntityCompletenessService } from '../../shared/services/entity-completeness.service';
import { ManualNumberSettingsService } from '../../shared/services/manual-number-settings.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { WorkflowService } from '../../shared/services/workflow.service';
import { PartDetail } from './models/part-detail.model';
import { PartListItem, PartListRow } from './models/part-list-item.model';
import { WorkflowRun } from '../../shared/models/workflow-run.model';
import { PartsComponent } from './parts.component';
import { PartsService } from './services/parts.service';

interface PartsHarness {
  searchControl: FormControl<string | null>;
  appliedSearch: () => string;
  applyFilters(): void;
  clearSearch(): void;
  duplicatePart(part: PartListItem): void;
  duplicating: () => boolean;
  partForm: FormGroup;
  savePart(): void;
  savingPart: () => boolean;
}

describe('PartsComponent search and Duplicate', () => {
  let partsService: {
    getPartsPaged: ReturnType<typeof vi.fn>;
    getPartById: ReturnType<typeof vi.fn>;
    createPart: ReturnType<typeof vi.fn>;
  };
  let lastScan: ReturnType<typeof signal<ScanEvent | null>>;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let detailDialog: { getDetailFromUrl: ReturnType<typeof vi.fn>; open: ReturnType<typeof vi.fn> };
  let destroyCallbacks: (() => void)[];

  beforeEach(() => {
    vi.useFakeTimers();
    partsService = {
      getPartsPaged: vi.fn(() => of({ items: [], totalCount: 0 })),
      getPartById: vi.fn(() => of({ id: 3, partNumber: 'BRK-100', name: 'Bracket' } as PartDetail)),
      createPart: vi.fn(() => new Subject()),
    };
    lastScan = signal<ScanEvent | null>(null);
    dialog = { open: vi.fn() };
    detailDialog = {
      getDetailFromUrl: vi.fn(() => null),
      open: vi.fn(() => ({ componentInstance: { partCreated: new Subject<void>() }, afterClosed: () => new Subject<void>() })),
    };
    destroyCallbacks = [];

    TestBed.configureTestingModule({
      providers: [
        { provide: PartsService, useValue: partsService },
        { provide: ManualNumberSettingsService, useValue: { isEnabled: () => false } },
        { provide: MatDialog, useValue: dialog },
        { provide: SnackbarService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ScannerService,
          useValue: { lastScan, setContext: vi.fn(), clearLastScan: () => lastScan.set(null) },
        },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
        { provide: ActivatedRoute, useValue: { queryParamMap: of(convertToParamMap({})) } },
        { provide: Router, useValue: { navigate: vi.fn(() => Promise.resolve(true)) } },
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn() } },
        { provide: DetailDialogService, useValue: detailDialog },
        { provide: WorkflowService, useValue: { listActive: vi.fn(() => of([])) } },
        { provide: EntityCompletenessService, useValue: { prime: vi.fn() } },
        {
          provide: DestroyRef,
          useValue: { onDestroy: (callback: () => void) => { destroyCallbacks.push(callback); return () => undefined; } },
        },
      ],
    });
  });

  afterEach(() => {
    destroyCallbacks.forEach(callback => callback());
    vi.useRealTimers();
  });

  function create(): PartsHarness {
    const component = TestBed.runInInjectionContext(() => new PartsComponent()) as unknown as PartsHarness;
    TestBed.tick();
    partsService.getPartsPaged.mockClear();
    return component;
  }

  function searchTerms(): (string | undefined)[] {
    return partsService.getPartsPaged.mock.calls.map(([params]) => (params as { q?: string }).q);
  }

  it('sends one request per typed term, after the debounce', () => {
    const parts = create();

    parts.searchControl.setValue('br');
    vi.advanceTimersByTime(100);
    parts.searchControl.setValue('brk');
    vi.advanceTimersByTime(300);

    expect(searchTerms()).toEqual(['brk']);
    expect(parts.appliedSearch()).toBe('brk');
  });

  it('does not reload when the typed term only changes by surrounding spaces', () => {
    const parts = create();

    parts.searchControl.setValue('brk');
    vi.advanceTimersByTime(300);
    parts.searchControl.setValue('brk ');
    vi.advanceTimersByTime(300);

    expect(searchTerms()).toEqual(['brk']);
  });

  it('applies Enter at once and drops the debounced echo of the same term', () => {
    const parts = create();

    parts.searchControl.setValue('brk');
    parts.applyFilters();
    expect(searchTerms()).toEqual(['brk']);

    vi.advanceTimersByTime(300);
    expect(searchTerms()).toEqual(['brk']);
  });

  it('reloads on every Enter, even when the term repeats', () => {
    const parts = create();

    parts.searchControl.setValue('brk');
    parts.applyFilters();
    parts.applyFilters();
    vi.advanceTimersByTime(300);

    expect(searchTerms()).toEqual(['brk', 'brk']);
  });

  it('reloads once per scan, including the same barcode scanned twice', () => {
    const parts = create();

    lastScan.set({ value: 'BRK-100', timestamp: new Date(), context: 'parts' });
    TestBed.tick();
    vi.advanceTimersByTime(300);
    lastScan.set({ value: 'BRK-100', timestamp: new Date(), context: 'parts' });
    TestBed.tick();
    vi.advanceTimersByTime(300);

    expect(parts.searchControl.value).toBe('BRK-100');
    expect(searchTerms()).toEqual(['BRK-100', 'BRK-100']);
  });

  it('clears the search with one request and no echo', () => {
    const parts = create();
    parts.searchControl.setValue('brk');
    parts.applyFilters();
    partsService.getPartsPaged.mockClear();

    parts.clearSearch();
    vi.advanceTimersByTime(300);

    expect(searchTerms()).toEqual([undefined]);
    expect(parts.appliedSearch()).toBe('');
  });

  it('opens one Duplicate dialog at a time and opens the copy once it is created', () => {
    const closed = new Subject<PartDetail | null>();
    dialog.open.mockReturnValue({ afterClosed: () => closed });
    const parts = create();
    const row = { id: 3, partNumber: 'BRK-100', status: 'Active' } as PartListItem;

    parts.duplicatePart(row);
    parts.duplicatePart(row);

    expect(partsService.getPartById).toHaveBeenCalledTimes(1);
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(parts.duplicating()).toBe(true);

    closed.next({ id: 9, partNumber: 'BRK-101', status: 'Draft' } as PartDetail);

    expect(parts.duplicating()).toBe(false);
    expect(partsService.getPartsPaged).toHaveBeenCalledTimes(1);
    expect(detailDialog.open).toHaveBeenCalledTimes(1);
    expect(detailDialog.open.mock.calls[0][1]).toBe(9);
  });

  it('allows another Duplicate after the dialog is cancelled', () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(null) });
    const parts = create();
    const row = { id: 3, partNumber: 'BRK-100', status: 'Active' } as PartListItem;

    parts.duplicatePart(row);
    parts.duplicatePart(row);

    expect(dialog.open).toHaveBeenCalledTimes(2);
    expect(detailDialog.open).not.toHaveBeenCalled();
  });

  describe('drafts and filters', () => {
    interface DraftHarness {
      entitylessDrafts: { set(runs: WorkflowRun[]): void };
      combinedRows: () => PartListRow[];
      hiddenDraftCount: () => number;
      hasActiveFilters: () => boolean;
      statusFilterControl: FormControl<string | null>;
      procurementFilterControl: FormControl<string | null>;
      showDrafts(): void;
      clearFilters(): void;
    }

    const draft = { id: 4, entityType: 'Part', entityId: null, currentStepId: 'basics', startedAt: '2026-10-01T00:00:00Z', lastActivityAt: '2026-10-01T00:00:00Z' } as WorkflowRun;

    function createWithDraft(): DraftHarness {
      const parts = create() as unknown as DraftHarness;
      parts.entitylessDrafts.set([draft]);
      return parts;
    }

    it('keeps entity-less drafts out of the Active list and offers them as a count', () => {
      const parts = createWithDraft();

      expect(parts.combinedRows()).toEqual([]);
      expect(parts.hiddenDraftCount()).toBe(1);

      parts.showDrafts();
      TestBed.tick();

      expect(parts.statusFilterControl.value).toBe('Draft');
      expect(parts.combinedRows().map(r => r.id)).toEqual([-4]);
      expect(parts.hiddenDraftCount()).toBe(0);
    });

    it('lists drafts under All', () => {
      const parts = createWithDraft();

      parts.statusFilterControl.setValue('');
      TestBed.tick();

      expect(parts.combinedRows().map(r => r.id)).toEqual([-4]);
    });

    it('tells a filtered empty list apart from an empty catalog and clears back to the default', () => {
      const parts = create() as unknown as DraftHarness & PartsHarness;
      expect(parts.hasActiveFilters()).toBe(false);

      parts.procurementFilterControl.setValue('Buy');
      parts.searchControl.setValue('zzz');
      parts.applyFilters();
      expect(parts.hasActiveFilters()).toBe(true);

      parts.clearFilters();
      vi.advanceTimersByTime(300);

      expect(parts.procurementFilterControl.value).toBe('');
      expect(parts.appliedSearch()).toBe('');
      expect(parts.hasActiveFilters()).toBe(false);
    });
  });

  it('creates one part when Create is pressed twice before the server answers', () => {
    const parts = create();
    parts.partForm.patchValue({ name: 'Bracket' });

    parts.savePart();
    parts.savePart();

    expect(partsService.createPart).toHaveBeenCalledTimes(1);
    expect(parts.savingPart()).toBe(true);
  });

  it('lets Create be pressed again after the server rejects the first press', () => {
    partsService.createPart.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    const parts = create();
    parts.partForm.patchValue({ name: 'Bracket' });

    parts.savePart();
    expect(parts.savingPart()).toBe(false);
    parts.savePart();

    expect(partsService.createPart).toHaveBeenCalledTimes(2);
  });
});
