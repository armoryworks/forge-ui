import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';

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
  columns: { set(cols: BoardColumn[]): void };
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

  beforeEach(() => {
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
            getBoard: () => of([]),
            getUsers: () => of([]),
            bulkMoveStage,
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
        { provide: UserPreferencesService, useValue: { get: () => null, set: vi.fn() } },
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
    component = TestBed.createComponent(KanbanComponent)
      .componentInstance as unknown as ComponentInternals;
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
});
