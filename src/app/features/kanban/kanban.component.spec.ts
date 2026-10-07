import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of, Subject } from 'rxjs';
import { CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';

import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';

import { KanbanComponent } from './kanban.component';
import { KanbanService } from './services/kanban.service';
import { BoardColumn } from './models/board-column.model';
import { KanbanJob } from './models/kanban-job.model';
import { Stage } from '../../shared/models/stage.model';
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
  selectTrackType(trackTypeId: number): void;
  onCardDropped(event: CdkDragDrop<KanbanJob[]>): void;
  selectedJobIds: { set(ids: Set<number>): void };
  disabledBulkStageIds: () => Set<number>;
  onJobNumberClicked(event: { job: KanbanJob; event: Event }): void;
  onAccountingRefClicked(event: { job: KanbanJob; event: Event }): void;
  bulkMoveToStage(stage: Stage): void;
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

  function createComponent(): void {
    component = TestBed.createComponent(KanbanComponent)
      .componentInstance as unknown as ComponentInternals;
  }

  beforeEach(() => {
    getBoard = vi.fn(() => of({ columns: [], totalCount: 0, loadedCount: 0 }));
    updateJobPosition = vi.fn(() => of(undefined));
    moveJobStage = vi.fn(() => of(undefined));
    prefsSet = vi.fn();
    storedPrefs = {};
    detailDialogOpen = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    bulkMoveStage = vi.fn(() => of({ successCount: 0, failureCount: 0, errors: [] }));
    snackbarSuccess = vi.fn();
    toastShow = vi.fn();

    TestBed.configureTestingModule({
      imports: [KanbanComponent],
      providers: [
        {
          provide: KanbanService,
          useValue: {
            getTrackTypes: () => of([]),
            getBoard,
            getUsers: () => of([]),
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
        { provide: Router, useValue: { navigate: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
            snapshot: { queryParamMap: convertToParamMap({}) },
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

      expect(component.filteredColumns()[0].jobs.map(j => j.id)).toEqual([1, 2, 3]);
      expect(prefsSet).toHaveBeenCalledWith('kanban:activeOnly', false);
    });

    it('starts off when the saved preference is off', () => {
      storedPrefs['kanban:activeOnly'] = false;
      createComponent();
      component.columns.set(mixedBoard());

      expect(component.activeOnly()).toBe(false);
      expect(component.filteredColumns()[0].jobs.length).toBe(3);
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
});
