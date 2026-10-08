import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, NavigationExtras, ParamMap, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';

import { FormControl } from '@angular/forms';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { KanbanComponent } from './kanban.component';
import { KanbanService } from './services/kanban.service';
import { BoardColumn } from './models/board-column.model';
import { KanbanJob } from './models/kanban-job.model';
import { Stage } from '../../shared/models/stage.model';
import { TeamRef } from '../../shared/models/team-ref.model';
import { AuthService } from '../../shared/services/auth.service';
import { BoardHubService } from '../../shared/services/board-hub.service';
import { DetailDialogService } from '../../shared/services/detail-dialog.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { LoadingService } from '../../shared/services/loading.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

function stage(overrides: Partial<Stage> & Pick<Stage, 'id' | 'name' | 'sortOrder'>): Stage {
  return {
    code: overrides.name.toLowerCase().replace(/[^a-z]+/g, '_'),
    color: '#94a3b8',
    wipLimit: null,
    accountingDocumentType: null,
    isIrreversible: false,
    isMandatory: false,
    ...overrides,
  };
}

function boardJob(id: number, stageName: string, overrides: Partial<KanbanJob> = {}): KanbanJob {
  return {
    id,
    jobNumber: `JOB-${String(id).padStart(4, '0')}`,
    title: `Job ${id}`,
    stageName,
    stageColor: '#94a3b8',
    assigneeId: null,
    assigneeInitials: null,
    assigneeColor: null,
    priorityName: 'Normal',
    dueDate: null,
    isOverdue: false,
    customerName: null,
    customerId: null,
    salesOrderId: null,
    salesOrderNumber: null,
    billingStatus: null,
    externalRef: null,
    accountingDocumentType: null,
    disposition: null,
    childJobCount: 0,
    activeHolds: [],
    coverPhotoUrl: null,
    parentJobId: null,
    parentJobNumber: null,
    boardPosition: 0,
    partNumber: null,
    quantity: null,
    ...overrides,
  };
}

/**
 * Production-track tail mirroring the seeded board: QC/Review(7) →
 * Shipped(8, mandatory) → Invoiced/Sent(9, mandatory, irreversible) →
 * Payment Received(10, final, irreversible). One job per column.
 */
function productionBoard(): BoardColumn[] {
  const stages: Stage[] = [
    stage({ id: 7, name: 'QC/Review', sortOrder: 7 }),
    stage({ id: 8, name: 'Shipped', sortOrder: 8, isMandatory: true }),
    stage({ id: 9, name: 'Invoiced/Sent', sortOrder: 9, isMandatory: true, isIrreversible: true }),
    stage({ id: 10, name: 'Payment Received', sortOrder: 10, isIrreversible: true }),
  ];
  return stages.map((s, i) => ({
    stage: s,
    jobs: [boardJob(100 + i, s.name, s.id === 10
      ? { externalRef: 'QB-PMT-77', accountingDocumentType: 'Payment', billingStatus: 'Invoiced' }
      : {})],
  }));
}

interface ComponentInternals {
  columns: { set(cols: BoardColumn[]): void; (): BoardColumn[] };
  filteredColumns: () => BoardColumn[];
  swimlaneRows: () => { cells: { jobs: KanbanJob[] }[] }[];
  activeOnly: () => boolean;
  boardTruncated: () => boolean;
  boardTotalCount: () => number;
  boardLoadedCount: () => number;
  toggleActiveOnly(): void;
  toggleOverdue(): void;
  toggleOnHold(): void;
  overdueOnly: () => boolean;
  onHoldOnly: () => boolean;
  searchControl: FormControl<string>;
  customerFilter: FormControl<number | null>;
  customerOptions: () => { value: unknown; label: string }[];
  selectTrackType(trackTypeId: number): void;
  onCardDropped(event: CdkDragDrop<KanbanJob[]>): void;
  selectedJobIds: { set(ids: Set<number>): void };
  disabledBulkStageIds: () => Set<number>;
  onJobNumberClicked(event: { job: KanbanJob; event: Event }): void;
  onAccountingRefClicked(event: { job: KanbanJob; event: Event }): void;
  bulkMoveToStage(stage: Stage): void;
  teams: () => TeamRef[];
  teamFilterOptions: () => { value: unknown; label: string }[];
  teamFilterId: () => number | null;
  teamFilter: { value: number | null; setValue(value: number | null): void };
}

describe('KanbanComponent', () => {
  let component: ComponentInternals;
  let detailDialogOpen: ReturnType<typeof vi.fn>;
  let bulkMoveStage: ReturnType<typeof vi.fn>;
  let snackbarSuccess: ReturnType<typeof vi.fn>;
  let toastShow: ReturnType<typeof vi.fn>;
  let getBoard: ReturnType<typeof vi.fn>;
  let updateJobPosition: ReturnType<typeof vi.fn>;
  let moveJobStage: ReturnType<typeof vi.fn>;
  let prefsSet: ReturnType<typeof vi.fn>;
  let storedPrefs: Record<string, unknown>;
  let getTeams: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let queryParams: BehaviorSubject<ParamMap>;

  function createComponent(): void {
    component = TestBed.createComponent(KanbanComponent)
      .componentInstance as unknown as ComponentInternals;
  }

  beforeEach(() => {
    getBoard = vi.fn(() => of({ columns: [], totalCount: 0, loadedCount: 0 }));
    getTeams = vi.fn(() => of([]));
    updateJobPosition = vi.fn(() => of(undefined));
    moveJobStage = vi.fn(() => of(undefined));
    prefsSet = vi.fn();
    storedPrefs = {};
    detailDialogOpen = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    bulkMoveStage = vi.fn(() => of({ successCount: 0, failureCount: 0, errors: [] }));
    snackbarSuccess = vi.fn();
    toastShow = vi.fn();
    queryParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));
    navigate = vi.fn((_commands: unknown[], extras: NavigationExtras) => {
      const merged: Record<string, string> = {};
      for (const key of queryParams.value.keys) merged[key] = queryParams.value.get(key)!;
      for (const [key, value] of Object.entries(extras.queryParams ?? {})) {
        if (value == null) delete merged[key];
        else merged[key] = String(value);
      }
      queryParams.next(convertToParamMap(merged));
      return Promise.resolve(true);
    });

    TestBed.configureTestingModule({
      imports: [KanbanComponent],
      providers: [
        {
          provide: KanbanService,
          useValue: {
            getTrackTypes: () => of([]),
            getBoard,
            getUsers: () => of([]),
            getTeams,
            getCustomers: () => of([{ id: 42, name: 'Design partner' }]),
            bulkMoveStage,
            updateJobPosition,
            getJobDetail: () => of({}),
            moveJobStage,
          },
        },
        {
          provide: BoardHubService,
          useValue: {
            connect: () => Promise.resolve(),
            disconnect: () => Promise.resolve(),
            joinBoard: () => Promise.resolve(),
            onJobCreatedEvent: vi.fn(),
            onJobMovedEvent: vi.fn(),
            onJobUpdatedEvent: vi.fn(),
            onJobPositionChangedEvent: vi.fn(),
            onBoardUpdatedEvent: vi.fn(),
          },
        },
        { provide: LoadingService, useValue: { track: (_m: string, obs: Observable<unknown>) => obs } },
        { provide: SnackbarService, useValue: { success: snackbarSuccess, error: vi.fn(), info: vi.fn() } },
        { provide: ToastService, useValue: { show: toastShow } },
        { provide: ScannerService, useValue: { setContext: vi.fn(), clearLastScan: vi.fn(), lastScan: () => null } },
        { provide: DetailDialogService, useValue: { open: detailDialogOpen, getDetailFromUrl: () => null } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: AuthService, useValue: { user: () => null } },
        { provide: UserPreferencesService, useValue: { get: (key: string) => storedPrefs[key] ?? null, set: prefsSet } },
        { provide: DraftResumeService, useValue: { consume: () => false } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
        { provide: Router, useValue: { navigate } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParams.asObservable(),
            get snapshot() { return { queryParamMap: queryParams.value }; },
          },
        },
      ],
    });

    // Class-logic spec — the (heavy, child-component-laden) template is not
    // under test here; job-card.component.spec.ts covers the card DOM.
    TestBed.overrideComponent(KanbanComponent, { set: { template: '' } });
    createComponent();
  });

  // ── Task 3: the job-number click opens the detail in EVERY column ──

  it('opens the job detail from jobNumberClicked for cards in all columns, including the final irreversible one', () => {
    const board = productionBoard();
    component.columns.set(board);

    for (const col of board) {
      detailDialogOpen.mockClear();
      const job = col.jobs[0];

      component.onJobNumberClicked({ job, event: new Event('click') });

      expect(detailDialogOpen, `column '${col.stage.name}'`).toHaveBeenCalledOnce();
      // DetailDialogService.open(entityType, entityId, component, data)
      expect(detailDialogOpen.mock.calls[0][0]).toBe('job');
      expect(detailDialogOpen.mock.calls[0][1]).toBe(job.id);
    }
  });

  it('opens the job detail when the accounting externalRef chip is clicked', () => {
    const board = productionBoard();
    component.columns.set(board);
    const finalJob = board[3].jobs[0];

    component.onAccountingRefClicked({ job: finalJob, event: new Event('click') });

    expect(detailDialogOpen).toHaveBeenCalledOnce();
    expect(detailDialogOpen.mock.calls[0][0]).toBe('job');
    expect(detailDialogOpen.mock.calls[0][1]).toBe(finalJob.id);
  });

  // ── Task 1: invalid bulk-move targets are disabled client-side ──

  it('disables bulk targets that would skip a mandatory stage for every selected job', () => {
    const board = productionBoard();
    component.columns.set(board);
    component.selectedJobIds.set(new Set([100])); // job in QC/Review (sort 7)

    const disabled = component.disabledBulkStageIds();

    expect(disabled.has(7)).toBe(true);   // own stage — no-op
    expect(disabled.has(8)).toBe(false);  // adjacent move into Shipped is legal
    expect(disabled.has(9)).toBe(true);   // skips mandatory Shipped
    expect(disabled.has(10)).toBe(true);  // skips Shipped + Invoiced/Sent
  });

  it('disables backward targets for a selection stuck in an irreversible stage', () => {
    const board = productionBoard();
    component.columns.set(board);
    component.selectedJobIds.set(new Set([102])); // job in Invoiced/Sent (irreversible)

    const disabled = component.disabledBulkStageIds();

    expect(disabled.has(7)).toBe(true);   // backward out of irreversible
    expect(disabled.has(8)).toBe(true);   // backward out of irreversible
    expect(disabled.has(10)).toBe(false); // forward to the final stage is legal
  });

  it('keeps a target enabled when at least one selected job can legally move there', () => {
    const board = productionBoard();
    component.columns.set(board);
    // One job in QC (can move to Shipped), one in Invoiced/Sent (cannot).
    component.selectedJobIds.set(new Set([100, 102]));

    expect(component.disabledBulkStageIds().has(8)).toBe(false);
  });

  // ── Task 1: per-job bulk failures are surfaced with the server's messages ──

  it('surfaces per-job bulk-move failures via a warning toast with the server messages', () => {
    const board = productionBoard();
    component.columns.set(board);
    component.selectedJobIds.set(new Set([100, 101]));
    bulkMoveStage.mockReturnValue(of({
      successCount: 1,
      failureCount: 1,
      errors: [{ jobId: 101, message: "Job JOB-0101: cannot move to 'Payment Received' — this would skip the mandatory stage 'Invoiced/Sent'." }],
    }));

    component.bulkMoveToStage(board[3].stage);

    expect(snackbarSuccess).toHaveBeenCalledOnce();
    expect(toastShow).toHaveBeenCalledOnce();
    const toast = toastShow.mock.calls[0][0] as { severity: string; details: string };
    expect(toast.severity).toBe('warning');
    expect(toast.details).toContain("mandatory stage 'Invoiced/Sent'");
  });

  it('does not show a success snackbar when every job in the bulk move fails', () => {
    const board = productionBoard();
    component.columns.set(board);
    component.selectedJobIds.set(new Set([100]));
    bulkMoveStage.mockReturnValue(of({
      successCount: 0,
      failureCount: 1,
      errors: [{ jobId: 100, message: 'Job JOB-0100: blocked.' }],
    }));

    component.bulkMoveToStage(board[3].stage);

    expect(snackbarSuccess).not.toHaveBeenCalled();
    expect(toastShow).toHaveBeenCalledOnce();
  });

  describe('active only filter', () => {
    function mixedBoard(): BoardColumn[] {
      return [{
        stage: stage({ id: 1, name: 'Shipped', sortOrder: 1 }),
        jobs: [
          boardJob(1, 'Shipped'),
          boardJob(2, 'Shipped', { disposition: 'ShipToCustomer' }),
          boardJob(3, 'Shipped', { completedDate: '2026-10-01T00:00:00Z' }),
          boardJob(4, 'Shipped', { billingStatus: 'Uninvoiced' }),
        ],
      }];
    }

    it('is on by default and hides completed and disposed work orders on the board and in swimlanes', () => {
      component.columns.set(mixedBoard());

      expect(component.activeOnly()).toBe(true);
      expect(component.filteredColumns()[0].jobs.map(j => j.id)).toEqual([1]);
      const swimJobs = component.swimlaneRows().flatMap(r => r.cells.flatMap(c => c.jobs.map(j => j.id)));
      expect(swimJobs).toEqual([1]);
    });

    it('shows every work order once toggled off and remembers the choice', () => {
      component.columns.set(mixedBoard());

      component.toggleActiveOnly();

      expect(component.filteredColumns()[0].jobs.map(j => j.id)).toEqual([1, 2, 3, 4]);
      expect(prefsSet).toHaveBeenCalledWith('kanban:activeOnly', false);
    });

    it('starts off when the saved preference is off', () => {
      storedPrefs['kanban:activeOnly'] = false;
      createComponent();
      component.columns.set(mixedBoard());

      expect(component.activeOnly()).toBe(false);
      expect(component.filteredColumns()[0].jobs.length).toBe(4);
    });
  });

  describe('board filters', () => {
    function lastBoardFilters(): unknown {
      return getBoard.mock.calls.at(-1)?.[1];
    }

    it('loads the board with the search, customer, overdue and on-hold filters from the URL', () => {
      queryParams.next(convertToParamMap({ q: 'J-2403', customer: '42', overdue: 'true', onHold: 'true' }));
      createComponent();

      component.selectTrackType(1);

      expect(getBoard).toHaveBeenLastCalledWith(1, {
        activeOnly: true, search: 'J-2403', customerId: 42, overdueOnly: true, onHoldOnly: true, teamId: null,
      });
      expect(component.searchControl.value).toBe('J-2403');
      expect(component.customerFilter.value).toBe(42);
      expect(component.overdueOnly()).toBe(true);
      expect(component.onHoldOnly()).toBe(true);
    });

    it('ignores a customer id in the URL that is not a positive whole number', () => {
      queryParams.next(convertToParamMap({ customer: 'abc' }));
      createComponent();

      component.selectTrackType(1);

      expect(lastBoardFilters()).toEqual(expect.objectContaining({ customerId: null }));
    });

    it('round-trips each filter through the URL and reloads the board on every change', () => {
      component.selectTrackType(1);
      getBoard.mockClear();

      component.toggleOverdue();
      expect(navigate).toHaveBeenLastCalledWith([], {
        queryParams: { overdue: 'true' }, queryParamsHandling: 'merge', replaceUrl: true,
      });
      expect(lastBoardFilters()).toEqual(expect.objectContaining({ overdueOnly: true }));

      component.customerFilter.setValue(42);
      expect(queryParams.value.get('customer')).toBe('42');
      expect(lastBoardFilters()).toEqual(expect.objectContaining({ customerId: 42, overdueOnly: true }));

      component.toggleOnHold();
      component.toggleOverdue();
      expect(queryParams.value.has('overdue')).toBe(false);
      expect(queryParams.value.get('onHold')).toBe('true');
      expect(lastBoardFilters()).toEqual({
        activeOnly: true, search: '', customerId: 42, overdueOnly: false, onHoldOnly: true, teamId: null,
      });
      expect(getBoard).toHaveBeenCalledTimes(4);
    });

    it('debounces the search box before writing it to the URL', () => {
      vi.useFakeTimers();
      try {
        component.selectTrackType(1);
        getBoard.mockClear();

        component.searchControl.setValue('J-24');
        component.searchControl.setValue('J-2403 ');
        vi.advanceTimersByTime(299);
        expect(queryParams.value.has('q')).toBe(false);
        expect(getBoard).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1);
        expect(queryParams.value.get('q')).toBe('J-2403');
        expect(getBoard).toHaveBeenCalledTimes(1);
        expect(lastBoardFilters()).toEqual(expect.objectContaining({ search: 'J-2403' }));

        component.searchControl.setValue('');
        vi.advanceTimersByTime(300);
        expect(queryParams.value.has('q')).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    });

    it('puts filters changed in the URL back into the toolbar controls', () => {
      component.selectTrackType(1);

      queryParams.next(convertToParamMap({ q: 'bracket', customer: '42' }));
      expect(component.searchControl.value).toBe('bracket');
      expect(component.customerFilter.value).toBe(42);

      queryParams.next(convertToParamMap({}));
      expect(component.searchControl.value).toBe('');
      expect(component.customerFilter.value).toBeNull();
      expect(lastBoardFilters()).toEqual(expect.objectContaining({ search: '', customerId: null }));
    });

    it('does not reload when an unrelated query parameter changes', () => {
      component.selectTrackType(1);
      getBoard.mockClear();

      queryParams.next(convertToParamMap({ detail: 'job:7' }));

      expect(getBoard).not.toHaveBeenCalled();
    });

    it('asks the server again when active only is toggled', () => {
      component.selectTrackType(1);

      component.toggleActiveOnly();

      expect(lastBoardFilters()).toEqual(expect.objectContaining({ activeOnly: false }));
    });

    it('offers every customer plus an all-customers choice', async () => {
      (component as unknown as { ngOnInit(): void }).ngOnInit();
      await Promise.resolve();

      expect(component.customerOptions().map(o => o.value)).toEqual([null, 42]);
    });
  });

  describe('board truncation', () => {
    it('flags the board as truncated when the server holds more jobs than were loaded', () => {
      getBoard.mockReturnValue(of({ columns: productionBoard(), totalCount: 245, loadedCount: 200 }));

      component.selectTrackType(1);

      expect(component.boardTruncated()).toBe(true);
      expect(component.boardTotalCount()).toBe(245);
      expect(component.boardLoadedCount()).toBe(200);
    });

    it('does not flag a board that loaded every job', () => {
      getBoard.mockReturnValue(of({ columns: productionBoard(), totalCount: 4, loadedCount: 4 }));

      component.selectTrackType(1);

      expect(component.boardTruncated()).toBe(false);
    });
  });

  describe('reordering cards', () => {
    it('saves the dragged order and leaves hidden work orders where they were', () => {
      component.columns.set([{
        stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }),
        jobs: [
          boardJob(1, 'Queued', { boardPosition: 0 }),
          boardJob(2, 'Queued', { boardPosition: 1, disposition: 'Scrap' }),
          boardJob(3, 'Queued', { boardPosition: 2 }),
          boardJob(4, 'Queued', { boardPosition: 3, disposition: 'Scrap' }),
        ],
      }]);
      const visible = component.filteredColumns()[0].jobs;
      const container = { id: 'column-0', data: visible } as unknown as CdkDropList<KanbanJob[]>;

      component.onCardDropped({
        previousContainer: container,
        container,
        previousIndex: 1,
        currentIndex: 0,
      } as unknown as CdkDragDrop<KanbanJob[]>);

      expect(component.columns()[0].jobs.map(j => j.id)).toEqual([3, 2, 1, 4]);
      expect(component.columns()[0].jobs.map(j => j.boardPosition)).toEqual([0, 1, 2, 3]);
      expect(updateJobPosition.mock.calls).toEqual([[3, 0], [1, 2]]);
    });

    it('reuses the existing positions of the swapped cards when they have gaps', () => {
      component.columns.set([{
        stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }),
        jobs: [
          boardJob(1, 'Queued', { boardPosition: 4 }),
          boardJob(2, 'Queued', { boardPosition: 7, disposition: 'Scrap' }),
          boardJob(3, 'Queued', { boardPosition: 9 }),
        ],
      }]);
      const container = { id: 'column-0', data: component.filteredColumns()[0].jobs } as unknown as CdkDropList<KanbanJob[]>;

      component.onCardDropped({
        previousContainer: container,
        container,
        previousIndex: 0,
        currentIndex: 1,
      } as unknown as CdkDragDrop<KanbanJob[]>);

      expect(component.columns()[0].jobs.map(j => j.id)).toEqual([3, 2, 1]);
      expect(updateJobPosition.mock.calls).toEqual([[3, 4], [1, 9]]);
    });

    it('spreads cards that share a position so the new order sticks', () => {
      component.toggleActiveOnly();
      component.columns.set([{
        stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }),
        jobs: [
          boardJob(1, 'Queued', { boardPosition: 0 }),
          boardJob(2, 'Queued', { boardPosition: 0 }),
          boardJob(3, 'Queued', { boardPosition: 0 }),
        ],
      }]);
      const container = { id: 'column-0', data: component.filteredColumns()[0].jobs } as unknown as CdkDropList<KanbanJob[]>;

      component.onCardDropped({
        previousContainer: container,
        container,
        previousIndex: 2,
        currentIndex: 0,
      } as unknown as CdkDragDrop<KanbanJob[]>);

      expect(component.columns()[0].jobs.map(j => j.id)).toEqual([3, 1, 2]);
      expect(component.columns()[0].jobs.map(j => j.boardPosition)).toEqual([0, 1, 2]);
      expect(updateJobPosition.mock.calls).toEqual([[1, 1], [2, 2]]);
    });

    it('does not re-save cards whose position did not change', () => {
      component.toggleActiveOnly();
      component.columns.set([{
        stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }),
        jobs: [
          boardJob(1, 'Queued', { boardPosition: 0 }),
          boardJob(2, 'Queued', { boardPosition: 1 }),
          boardJob(3, 'Queued', { boardPosition: 2 }),
        ],
      }]);
      const container = { id: 'column-0', data: component.filteredColumns()[0].jobs } as unknown as CdkDropList<KanbanJob[]>;

      component.onCardDropped({
        previousContainer: container,
        container,
        previousIndex: 2,
        currentIndex: 1,
      } as unknown as CdkDragDrop<KanbanJob[]>);

      expect(component.columns()[0].jobs.map(j => j.id)).toEqual([1, 3, 2]);
      expect(updateJobPosition.mock.calls).toEqual([[3, 1], [2, 2]]);
    });

    it('moves the card to the new status first, then saves the target column order', () => {
      component.columns.set([
        {
          stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }),
          jobs: [boardJob(1, 'Queued', { boardPosition: 0 }), boardJob(2, 'Queued', { boardPosition: 1 })],
        },
        {
          stage: stage({ id: 2, name: 'Running', sortOrder: 2 }),
          jobs: [boardJob(3, 'Running', { boardPosition: 0 })],
        },
      ]);
      const cols = component.filteredColumns();
      const source = { id: 'column-0', data: cols[0].jobs } as unknown as CdkDropList<KanbanJob[]>;
      const target = { id: 'column-1', data: cols[1].jobs } as unknown as CdkDropList<KanbanJob[]>;

      component.onCardDropped({
        previousContainer: source,
        container: target,
        previousIndex: 1,
        currentIndex: 1,
      } as unknown as CdkDragDrop<KanbanJob[]>);

      expect(moveJobStage).toHaveBeenCalledWith(2, 2);
      expect(moveJobStage.mock.invocationCallOrder[0]).toBeLessThan(updateJobPosition.mock.invocationCallOrder[0]);
      expect(updateJobPosition.mock.calls).toEqual([[2, 1]]);
      expect(component.columns()[0].jobs.map(j => j.id)).toEqual([1]);
      expect(component.columns()[1].jobs.map(j => j.id)).toEqual([3, 2]);
      expect(component.columns()[1].jobs[1].stageName).toBe('Running');
    });

    it('drops a moved card next to its visible neighbour without shifting hidden cards above it', () => {
      component.columns.set([
        {
          stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }),
          jobs: [boardJob(1, 'Queued', { boardPosition: 0 })],
        },
        {
          stage: stage({ id: 2, name: 'Running', sortOrder: 2 }),
          jobs: [
            boardJob(3, 'Running', { boardPosition: 0, disposition: 'Scrap' }),
            boardJob(4, 'Running', { boardPosition: 5 }),
            boardJob(5, 'Running', { boardPosition: 8 }),
          ],
        },
      ]);
      const cols = component.filteredColumns();
      const source = { id: 'column-0', data: cols[0].jobs } as unknown as CdkDropList<KanbanJob[]>;
      const target = { id: 'column-1', data: cols[1].jobs } as unknown as CdkDropList<KanbanJob[]>;

      component.onCardDropped({
        previousContainer: source,
        container: target,
        previousIndex: 0,
        currentIndex: 1,
      } as unknown as CdkDragDrop<KanbanJob[]>);

      expect(component.columns()[1].jobs.map(j => j.id)).toEqual([3, 4, 1, 5]);
      expect(component.columns()[1].jobs.map(j => j.boardPosition)).toEqual([0, 5, 6, 8]);
      expect(updateJobPosition.mock.calls).toEqual([[1, 6]]);
    });

    it('saves the drop slot even when a board reload lands before the move response', () => {
      const moveResponse = new Subject<void>();
      moveJobStage.mockReturnValue(moveResponse);
      component.columns.set([
        {
          stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }),
          jobs: [boardJob(1, 'Queued', { boardPosition: 0 })],
        },
        {
          stage: stage({ id: 2, name: 'Running', sortOrder: 2 }),
          jobs: [boardJob(3, 'Running', { boardPosition: 0 }), boardJob(4, 'Running', { boardPosition: 1 })],
        },
      ]);
      const cols = component.filteredColumns();
      const source = { id: 'column-0', data: cols[0].jobs } as unknown as CdkDropList<KanbanJob[]>;
      const target = { id: 'column-1', data: cols[1].jobs } as unknown as CdkDropList<KanbanJob[]>;

      component.onCardDropped({
        previousContainer: source,
        container: target,
        previousIndex: 0,
        currentIndex: 0,
      } as unknown as CdkDragDrop<KanbanJob[]>);

      component.columns.set([
        { stage: stage({ id: 1, name: 'Queued', sortOrder: 1 }), jobs: [] },
        {
          stage: stage({ id: 2, name: 'Running', sortOrder: 2 }),
          jobs: [
            boardJob(3, 'Running', { boardPosition: 0 }),
            boardJob(4, 'Running', { boardPosition: 1 }),
            boardJob(1, 'Running', { boardPosition: 2 }),
          ],
        },
      ]);
      moveResponse.next();
      moveResponse.complete();

      expect(updateJobPosition.mock.calls).toEqual([[1, 0], [3, 1], [4, 2]]);
    });
  });

  describe('team filter', () => {
    const teams: TeamRef[] = [
      { id: 3, name: 'Machining', color: null },
      { id: 5, name: 'Finishing', color: '#22c55e' },
    ];

    it('offers every team after an all-teams choice', () => {
      getTeams.mockReturnValue(of(teams));
      createComponent();
      (component as unknown as { ngOnInit(): void }).ngOnInit();

      expect(component.teams()).toEqual(teams);
      expect(component.teamFilterOptions().map(o => o.value)).toEqual([null, 3, 5]);
    });

    it('hides the filter quietly when the team list cannot be read', () => {
      getTeams.mockReturnValue(throwError(() => new Error('capability off')));
      createComponent();
      (component as unknown as { ngOnInit(): void }).ngOnInit();

      expect(component.teams()).toEqual([]);
    });

    it('loads the board for the team named in the URL', () => {
      queryParams.next(convertToParamMap({ team: '5' }));
      createComponent();

      component.selectTrackType(1);

      expect(component.teamFilterId()).toBe(5);
      expect(component.teamFilter.value).toBe(5);
      expect(getBoard).toHaveBeenLastCalledWith(1, expect.objectContaining({ teamId: 5 }));
    });

    it('ignores a team id in the URL that is not a positive whole number', () => {
      queryParams.next(convertToParamMap({ team: 'abc' }));
      createComponent();

      component.selectTrackType(1);

      expect(component.teamFilterId()).toBeNull();
      expect(getBoard).toHaveBeenLastCalledWith(1, expect.objectContaining({ teamId: null }));
    });

    it('writes the chosen team to the URL', () => {
      component.teamFilter.setValue(3);

      expect(navigate).toHaveBeenCalledWith([], { queryParams: { team: 3 }, queryParamsHandling: 'merge' });
    });

    it('clears the team from the URL when all teams is chosen', () => {
      component.teamFilter.setValue(null);

      expect(navigate).toHaveBeenCalledWith([], { queryParams: { team: null }, queryParamsHandling: 'merge' });
    });

    it('reloads the board and the picker when the URL team changes', () => {
      component.selectTrackType(1);
      getBoard.mockClear();
      navigate.mockClear();

      queryParams.next(convertToParamMap({ team: '3' }));

      expect(getBoard).toHaveBeenCalledOnce();
      expect(getBoard).toHaveBeenCalledWith(1, expect.objectContaining({ teamId: 3 }));
      expect(component.teamFilter.value).toBe(3);
      expect(navigate).not.toHaveBeenCalled();
    });

    it('does not reload when another query parameter changes', () => {
      component.selectTrackType(1);
      getBoard.mockClear();

      queryParams.next(convertToParamMap({ myWork: 'true' }));

      expect(getBoard).not.toHaveBeenCalled();
    });
  });
});
