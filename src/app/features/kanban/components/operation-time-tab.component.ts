import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatDialog } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, catchError, debounceTime, filter, map, of } from 'rxjs';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { OperationQuantityDialogComponent } from '../../../shared/components/operation-quantity-dialog/operation-quantity-dialog.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { JobOperationEntryType } from '../../../shared/models/job-operation-entry-type.type';
import { JobOperationProgressResult } from '../../../shared/models/job-operation-progress-result.model';
import { JobOperations } from '../../../shared/models/job-operations.model';
import { OperationQuantityDialogData } from '../../../shared/models/operation-quantity-dialog-data.model';
import { OperationQuantityDialogResult } from '../../../shared/models/operation-quantity-dialog-result.model';
import { UpdateJobOperationProgressRequest } from '../../../shared/models/update-job-operation-progress-request.model';
import { DurationMsPipe } from '../../../shared/pipes/duration-ms.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { BoardHubService } from '../../../shared/services/board-hub.service';
import { JobOperationsService } from '../../../shared/services/job-operations.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { secondTicker } from '../../../shared/utils/second-ticker';
import { JobCostService } from '../services/job-cost.service';
import { OperationProgressSnapshot } from '../models/operation-progress-snapshot.model';
import { OperationTimeRow } from '../models/operation-time-row.model';
import {
  efficiencyPercent,
  isJobOperations,
  legacyToOperationTimeRows,
  minutesToSecondsMs,
  toOperationTimeRows,
} from '../utils/operation-time-rows.utils';
import { SubcontractPanelComponent } from './subcontract-panel/subcontract-panel.component';

@Component({
  selector: 'app-operation-time-tab',
  standalone: true,
  imports: [
    DecimalPipe,
    MatMenuModule,
    MatTooltipModule,
    TranslatePipe,
    DataTableComponent,
    EmptyStateComponent,
    ColumnCellDirective,
    LoadingBlockDirective,
    DurationMsPipe,
    SubcontractPanelComponent,
  ],
  templateUrl: './operation-time-tab.component.html',
  styleUrl: './operation-time-tab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationTimeTabComponent {
  readonly jobId = input.required<number>();
  readonly allOperationsComplete = output<void>();

  private readonly operationsService = inject(JobOperationsService);
  private readonly costService = inject(JobCostService);
  private readonly auth = inject(AuthService);
  private readonly boardHub = inject(BoardHubService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(false);
  readonly busyRowId = signal<string | null>(null);
  readonly data = signal<JobOperations | null>(null);
  private readonly legacyRows = signal<OperationTimeRow[] | null>(null);
  private readonly loadedAt = signal(Date.now());
  private readonly now = secondTicker();

  readonly trackingEnabled = computed(() => this.data()?.trackingEnabled === true);
  readonly jobQuantity = computed(() => this.data()?.jobQuantity ?? 0);
  readonly remainingMs = computed(() => {
    const minutes = this.data()?.estimatedRemainingMinutes;
    return minutes === null || minutes === undefined ? null : minutesToSecondsMs(minutes);
  });

  private readonly hasOpenTimers = computed(() =>
    (this.data()?.operations ?? []).some(op => (op.openTimers ?? []).length > 0));

  readonly operations = computed<OperationTimeRow[]>(() => {
    const legacy = this.legacyRows();
    if (legacy) return legacy;
    const data = this.data();
    if (!data) return [];
    const loadedAt = this.loadedAt();
    const liveNow = this.hasOpenTimers() ? Math.max(this.now(), loadedAt) : loadedAt;
    return toOperationTimeRows(data, this.auth.user()?.id ?? null, liveNow, loadedAt);
  });

  private readonly baseColumns: ColumnDef[] = [
    { field: 'operationSequence', header: '#', sortable: true, width: '50px', align: 'center' },
    { field: 'operationName', header: this.translate.instant('jobOperations.columns.operation'), sortable: true },
    { field: 'estimatedSetupMinutes', header: this.translate.instant('jobOperations.columns.estSetup'), sortable: true, width: '90px', align: 'right' },
    { field: 'actualSetupMinutes', header: this.translate.instant('jobOperations.columns.actSetup'), sortable: true, width: '90px', align: 'right' },
    { field: 'estimatedRunMinutes', header: this.translate.instant('jobOperations.columns.estRun'), sortable: true, width: '90px', align: 'right' },
    { field: 'actualRunMinutes', header: this.translate.instant('jobOperations.columns.actRun'), sortable: true, width: '90px', align: 'right' },
    { field: 'actualTotalMinutes', header: this.translate.instant('jobOperations.columns.total'), sortable: true, width: '80px', align: 'right' },
    { field: 'efficiencyPercent', header: this.translate.instant('jobOperations.columns.efficiency'), sortable: true, type: 'number', width: '70px', align: 'right' },
    { field: 'progress', header: this.translate.instant('jobOperations.columns.progress'), width: '120px' },
  ];

  private readonly trackingColumns: ColumnDef[] = [
    this.baseColumns[0],
    this.baseColumns[1],
    { field: 'status', header: this.translate.instant('jobOperations.columns.status'), sortable: true, width: '110px' },
    { field: 'completedQuantity', header: this.translate.instant('jobOperations.columns.quantity'), sortable: true, width: '90px', align: 'right' },
    { field: 'timers', header: this.translate.instant('jobOperations.columns.timers'), width: '160px' },
    { field: 'actions', header: '', width: '110px', align: 'right' },
    { field: 'remainingMs', header: this.translate.instant('jobOperations.columns.remaining'), sortable: true, width: '100px', align: 'right' },
    { field: 'perPiece', header: this.translate.instant('jobOperations.columns.perPiece'), width: '140px' },
    ...this.baseColumns.slice(2),
  ];

  readonly opColumns = computed(() => this.trackingEnabled() ? this.trackingColumns : this.baseColumns);
  readonly tableId = computed(() => this.trackingEnabled() ? 'operation-time-tracking' : 'operation-time-analysis');
  readonly tableKeys = computed(() => [this.tableId()]);
  readonly loaded = signal(false);

  readonly totalEstimated = computed(() =>
    this.operations().reduce((sum, op) => sum + op.estimatedSetupMinutes + op.estimatedRunMinutes, 0));

  readonly totalActual = computed(() =>
    this.operations().reduce((sum, op) => sum + op.actualTotalMinutes, 0));

  readonly overallEfficiency = computed(() => efficiencyPercent(this.totalEstimated(), this.totalActual()));

  constructor() {
    effect(() => {
      const jobId = this.jobId();
      if (jobId) untracked(() => this.loadData(jobId));
    });

    this.boardHub.jobUpdated$.pipe(
      filter(event => (event as { jobId?: number } | null)?.jobId === this.jobId()),
      debounceTime(400),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.reload());
  }

  reload(): void {
    const jobId = this.jobId();
    if (jobId) this.loadData(jobId, false);
  }

  private loadData(jobId: number, showSpinner = true): void {
    if (showSpinner) this.loading.set(true);
    this.operationsService.getOperations(jobId).pipe(
      map(payload => ({ kind: 'operations' as const, payload: isJobOperations(payload) ? payload : null })),
      catchError(() => this.loadLegacy(jobId)),
    ).subscribe(result => {
      if (result.kind === 'operations') {
        this.legacyRows.set(null);
        this.loadedAt.set(Date.now());
        this.data.set(result.payload);
      } else {
        this.data.set(null);
        this.legacyRows.set(result.rows);
      }
      this.loaded.set(true);
      this.loading.set(false);
    });
  }

  private loadLegacy(jobId: number): Observable<{ kind: 'legacy'; rows: OperationTimeRow[] }> {
    return this.costService.getOperationTimeSummary(jobId).pipe(
      map(ops => ({ kind: 'legacy' as const, rows: legacyToOperationTimeRows(Array.isArray(ops) ? ops : []) })),
      catchError(() => of({ kind: 'legacy' as const, rows: [] })),
    );
  }

  startTimer(row: OperationTimeRow, entryType: JobOperationEntryType): void {
    const operationId = row.source?.operationId;
    if (operationId === null || operationId === undefined) return;
    this.busyRowId.set(row.id);
    this.operationsService.startTimer(this.jobId(), operationId, entryType).subscribe({
      next: () => this.afterWrite(),
      error: () => this.afterWrite(),
    });
  }

  stopTimer(row: OperationTimeRow): void {
    const operationId = row.source?.operationId;
    if (operationId === null || operationId === undefined) return;
    this.busyRowId.set(row.id);
    this.operationsService.stopTimer(this.jobId(), operationId).subscribe({
      next: () => this.afterWrite(),
      error: () => this.afterWrite(),
    });
  }

  markDone(row: OperationTimeRow): void {
    this.updateProgress(row, { status: 'Complete' }, 'jobOperations.messages.completed');
  }

  skip(row: OperationTimeRow): void {
    this.updateProgress(row, { status: 'Skipped' }, 'jobOperations.messages.skipped');
  }

  reopen(row: OperationTimeRow): void {
    this.updateProgress(row, { status: 'InProgress' }, 'jobOperations.messages.reopened');
  }

  reset(row: OperationTimeRow): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('jobOperations.resetTitle'),
        message: this.translate.instant('jobOperations.resetMessage', { operation: row.operationName }),
        confirmLabel: this.translate.instant('jobOperations.actions.reset'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.updateProgress(row, { status: 'NotStarted' }, 'jobOperations.messages.reset');
    });
  }

  openQuantity(row: OperationTimeRow): void {
    if (!row.canAct || !this.trackingEnabled()) return;
    this.dialog.open<OperationQuantityDialogComponent, OperationQuantityDialogData, OperationQuantityDialogResult | undefined>(
      OperationQuantityDialogComponent, {
        width: '420px',
        data: {
          title: row.operationName,
          jobQuantity: this.jobQuantity(),
          completedQuantity: row.completedQuantity,
          scrapQuantity: row.scrapQuantity,
        },
      }).afterClosed().subscribe(result => {
      if (!result) return;
      this.updateProgress(row, {
        completedQuantity: result.completedQuantity,
        scrapQuantity: result.scrapQuantity,
        status: result.complete ? 'Complete' : null,
      }, result.complete ? 'jobOperations.messages.completed' : 'jobOperations.messages.recorded');
    });
  }

  private updateProgress(row: OperationTimeRow, change: UpdateJobOperationProgressRequest, messageKey: string): void {
    const operationId = row.source?.operationId;
    if (operationId === null || operationId === undefined) return;
    const before: OperationProgressSnapshot = {
      status: row.status,
      completedQuantity: row.completedQuantity,
      scrapQuantity: row.scrapQuantity,
    };
    this.busyRowId.set(row.id);
    this.operationsService.updateProgress(this.jobId(), operationId, {
      ...change,
      expectedVersion: row.source?.version ?? null,
    }).subscribe({
      next: result => {
        this.afterWrite();
        this.offerUndo(operationId, row.operationName, before, result, messageKey);
        if (result.allOperationsComplete && (change.status === 'Complete' || change.status === 'Skipped')) {
          this.allOperationsComplete.emit();
        }
      },
      error: () => this.afterWrite(),
    });
  }

  private offerUndo(
    operationId: number,
    operationName: string,
    before: OperationProgressSnapshot,
    result: JobOperationProgressResult,
    messageKey: string,
  ): void {
    this.snackbar.successWithAction(
      this.translate.instant(messageKey, { operation: operationName }),
      this.translate.instant('jobOperations.actions.undo'),
    ).subscribe(() => {
      this.operationsService.updateProgress(this.jobId(), operationId, {
        status: before.status,
        completedQuantity: before.completedQuantity,
        scrapQuantity: before.scrapQuantity,
        expectedVersion: result.operation.version,
      }).subscribe({
        next: () => this.reload(),
        error: () => this.reload(),
      });
    });
  }

  private afterWrite(): void {
    this.busyRowId.set(null);
    this.reload();
  }

  formatMinutes(minutes: number): string {
    const totalSeconds = Math.round(minutes * 60);
    if (totalSeconds < 60) return `${totalSeconds}s`;
    if (totalSeconds < 3600) {
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}m ${String(s).padStart(2, '0')}s`;
    }
    const totalMinutes = Math.round(minutes);
    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  }

  getVarianceClass(variance: number): string {
    if (variance > 0) return 'op-time__variance--over';
    if (variance < 0) return 'op-time__variance--under';
    return '';
  }

  getEfficiencyClass(efficiency: number): string {
    if (efficiency >= 100) return 'op-time__efficiency--good';
    if (efficiency >= 80) return 'op-time__efficiency--fair';
    return 'op-time__efficiency--poor';
  }

  getEfficiencyBarClass(efficiency: number): string {
    if (efficiency >= 100) return 'op-time__bar-fill--good';
    if (efficiency >= 80) return 'op-time__bar-fill--fair';
    return 'op-time__bar-fill--poor';
  }

  getBarWidth(actual: number, estimated: number): number {
    if (estimated <= 0) return actual > 0 ? 100 : 0;
    return Math.min((actual / estimated) * 100, 150);
  }
}
