import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ProductionRunDialogData } from '../../models/production-run-dialog-data.model';
import { ProductionRunRow } from '../../models/production-run-row.model';
import { ProductionRunStatus } from '../../models/production-run-status.type';
import { ProductionRun } from '../../models/production-run.model';
import { PRODUCTION_RUN_WRITE_ROLES } from '../../production-run-roles';
import { ProductionRunsService } from '../../services/production-runs.service';
import { ProductionRunDialogComponent } from '../production-run-dialog/production-run-dialog.component';

const STATUS_CHIPS: Record<ProductionRunStatus, string> = {
  Planned: 'chip chip--muted',
  InProgress: 'chip chip--info',
  Completed: 'chip chip--success',
  Cancelled: 'chip chip--error',
};

@Component({
  selector: 'app-production-runs-section',
  standalone: true,
  imports: [DecimalPipe, MatTooltipModule, TranslatePipe, LoadingBlockDirective, DateTimePipe],
  templateUrl: './production-runs-section.component.html',
  styleUrl: './production-runs-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductionRunsSectionComponent {
  readonly jobId = input.required<number>();
  readonly partId = input<number | null>(null);
  readonly jobQuantity = input<number | null>(null);

  private readonly runsService = inject(ProductionRunsService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly runs = signal<ProductionRun[]>([]);
  readonly loading = signal(false);
  readonly busyRunId = signal<number | null>(null);

  readonly visible = computed(() =>
    this.partId() != null
    && this.capabilities.isEnabled('CAP-MFG-COMPLETE', true)
    && this.auth.hasAnyRole([...PRODUCTION_RUN_WRITE_ROLES]));

  readonly rows = computed<ProductionRunRow[]>(() => this.runs().map(run => {
    const received = run.receivedToStockAt != null;
    return {
      run,
      statusLabelKey: `productionRuns.status.${run.status}`,
      statusChipClass: STATUS_CHIPS[run.status] ?? 'chip',
      canStart: run.status === 'Planned',
      canStop: run.status === 'InProgress',
      canEdit: run.status !== 'Cancelled' && !received,
      canReceive: run.status === 'Completed' && !received && run.completedQuantity > 0,
      received,
      runTimeLabelKey: run.runTimeMinutes == null ? null
        : run.runTimeManual ? 'productionRuns.runTimeEntered' : 'productionRuns.runTimeDerived',
    };
  }));

  constructor() {
    effect(() => {
      const jobId = this.jobId();
      if (jobId && this.visible()) untracked(() => this.load(jobId));
    });
  }

  reload(): void {
    this.load(this.jobId());
  }

  private load(jobId: number): void {
    this.loading.set(true);
    this.runsService.getRuns(jobId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: runs => {
        this.runs.set(runs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    const partId = this.partId();
    if (partId == null) return;
    this.openDialog({ jobId: this.jobId(), partId, defaultTargetQuantity: this.jobQuantity(), run: null });
  }

  openEdit(run: ProductionRun): void {
    this.openDialog({ jobId: this.jobId(), partId: run.partId, defaultTargetQuantity: null, run });
  }

  private openDialog(data: ProductionRunDialogData): void {
    this.dialog.open<ProductionRunDialogComponent, ProductionRunDialogData, ProductionRun | undefined>(
      ProductionRunDialogComponent, { width: '520px', data },
    ).afterClosed().subscribe(saved => {
      if (saved) this.reload();
    });
  }

  start(run: ProductionRun): void {
    this.changeStatus(run, 'InProgress', 'productionRuns.started');
  }

  stop(run: ProductionRun): void {
    this.changeStatus(run, 'Completed', 'productionRuns.stopped');
  }

  private changeStatus(run: ProductionRun, status: ProductionRunStatus, messageKey: string): void {
    if (this.busyRunId() !== null) return;
    this.busyRunId.set(run.id);
    this.runsService.updateRun(this.jobId(), run.id, {
      completedQuantity: run.completedQuantity,
      scrapQuantity: run.scrapQuantity,
      status,
      notes: run.notes,
      setupTimeMinutes: run.setupTimeMinutes,
      runTimeMinutes: null,
      toolingAssetId: null,
    }).subscribe({
      next: saved => {
        this.busyRunId.set(null);
        this.snackbar.success(this.translate.instant(messageKey, { run: saved.runNumber }));
        this.reload();
      },
      error: (err: unknown) => {
        this.busyRunId.set(null);
        this.snackbar.errorFrom(err, 'productionRuns.saveFailed');
      },
    });
  }

  receive(run: ProductionRun): void {
    if (this.busyRunId() !== null) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('productionRuns.receiveTitle', { run: run.runNumber }),
        message: this.translate.instant('productionRuns.receiveMessage', { quantity: run.completedQuantity, part: run.partNumber }),
        confirmLabel: this.translate.instant('productionRuns.receive'),
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.doReceive(run);
    });
  }

  private doReceive(run: ProductionRun): void {
    this.busyRunId.set(run.id);
    this.runsService.receiveToStock(this.jobId(), run.id).subscribe({
      next: saved => {
        this.busyRunId.set(null);
        this.snackbar.success(saved.receiptJournalEntryNumber != null
          ? this.translate.instant('productionRuns.receivedWithJournal', { quantity: saved.receivedQuantity, entry: saved.receiptJournalEntryNumber })
          : this.translate.instant('productionRuns.received', { quantity: saved.receivedQuantity }));
        this.reload();
      },
      error: (err: unknown) => {
        this.busyRunId.set(null);
        this.snackbar.errorFrom(err, 'productionRuns.receiveFailed');
      },
    });
  }
}
