import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { DateOnlyPipe } from '../../../shared/pipes/date-only.pipe';
import { AuthService } from '../../../shared/services/auth.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { toDateOnly } from '../../../shared/utils/date.utils';
import { TimeTrackingService } from '../services/time-tracking.service';
import { LaborReconciliationRow } from '../models/labor-reconciliation-row.model';
import { LaborRecomputeResult } from '../models/labor-recompute-result.model';

const RECOMPUTE_ROLES = ['Admin', 'Manager', 'Controller'];
const DEFAULT_DAYS = 7;

@Component({
  selector: 'app-labor-reconciliation',
  standalone: true,
  imports: [
    ReactiveFormsModule, DecimalPipe, RouterLink, TranslatePipe, PageHeaderComponent, DatepickerComponent,
    DataTableComponent, ColumnCellDirective, DateOnlyPipe,
  ],
  templateUrl: './labor-reconciliation.component.html',
  styleUrl: './labor-reconciliation.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaborReconciliationComponent implements OnInit {
  private readonly service = inject(TimeTrackingService);
  private readonly translate = inject(TranslateService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly fromControl = new FormControl<Date | null>(daysAgo(DEFAULT_DAYS - 1));
  protected readonly toControl = new FormControl<Date | null>(daysAgo(0));
  protected readonly rows = signal<(LaborReconciliationRow & { id: string })[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly preview = signal<LaborRecomputeResult | null>(null);
  protected readonly recomputing = signal(false);
  private previewRange: { from: string; to: string } | null = null;
  protected readonly canRecompute = computed(() => this.auth.hasAnyRole(RECOMPUTE_ROLES));

  protected readonly columns: ColumnDef[] = [
    { field: 'date', header: this.translate.instant('laborReconciliation.columns.date'), sortable: true, width: '110px' },
    { field: 'userName', header: this.translate.instant('laborReconciliation.columns.person'), sortable: true },
    { field: 'paidMinutes', header: this.translate.instant('laborReconciliation.columns.paid'), sortable: true, align: 'right' },
    { field: 'jobLaborMinutes', header: this.translate.instant('laborReconciliation.columns.jobLabor'), sortable: true, align: 'right' },
    { field: 'indirectMinutes', header: this.translate.instant('laborReconciliation.columns.indirect'), sortable: true, align: 'right' },
    { field: 'unallocatedMinutes', header: this.translate.instant('laborReconciliation.columns.unallocated'), sortable: true, align: 'right' },
    { field: 'manualMinutes', header: this.translate.instant('laborReconciliation.columns.manual'), sortable: true, align: 'right' },
    { field: 'overlappingTimerMinutes', header: this.translate.instant('laborReconciliation.columns.overlap'), sortable: true, align: 'right' },
    { field: 'longTimers', header: this.translate.instant('laborReconciliation.columns.longTimers'), sortable: true, align: 'right' },
  ];

  protected readonly jobColumns: ColumnDef[] = [
    { field: 'jobNumber', header: this.translate.instant('laborReconciliation.recompute.job'), sortable: true },
    { field: 'entriesChanged', header: this.translate.instant('laborReconciliation.recompute.entries'), align: 'right' },
    { field: 'laborMinutesBefore', header: this.translate.instant('laborReconciliation.recompute.laborBefore'), align: 'right' },
    { field: 'laborMinutesAfter', header: this.translate.instant('laborReconciliation.recompute.laborAfter'), align: 'right' },
    { field: 'costBefore', header: this.translate.instant('laborReconciliation.recompute.costBefore'), align: 'right' },
    { field: 'costAfter', header: this.translate.instant('laborReconciliation.recompute.costAfter'), align: 'right' },
  ];

  protected readonly previewJobs = computed(() => (this.preview()?.jobs ?? []).map(job => ({
    ...job,
    id: job.jobId,
    costBefore: job.laborCostBefore + job.burdenCostBefore,
    costAfter: job.laborCostAfter + job.burdenCostAfter,
  })));

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    const range = this.range();
    if (!range) return;
    this.loading.set(true);
    this.error.set(null);
    this.preview.set(null);
    this.service.getLaborReconciliation(range.from, range.to).subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.rows.set(rows.map(row => ({ ...row, id: `${row.userId}-${row.date}` })));
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(reason(err));
      },
    });
  }

  protected runPreview(): void {
    const range = this.range();
    if (!range || !this.canRecompute() || this.recomputing()) return;
    this.recomputing.set(true);
    this.error.set(null);
    this.service.recomputeLabor({ ...range, preview: true }).subscribe({
      next: (result) => {
        this.recomputing.set(false);
        this.previewRange = range;
        this.preview.set(result);
      },
      error: (err: HttpErrorResponse) => {
        this.recomputing.set(false);
        this.error.set(reason(err));
      },
    });
  }

  protected apply(): void {
    const range = this.previewRange;
    const preview = this.preview();
    if (!range || !preview || !this.canRecompute() || this.recomputing()) return;
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '440px',
      data: {
        title: this.translate.instant('laborReconciliation.recompute.confirmTitle'),
        message: this.translate.instant('laborReconciliation.recompute.confirmMessage', {
          count: preview.entriesChanged, jobs: preview.jobs.length,
        }),
        confirmLabel: this.translate.instant('laborReconciliation.recompute.apply'),
        severity: 'warn',
      },
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.recomputing.set(true);
      this.service.recomputeLabor({ ...range, preview: false }).subscribe({
        next: (result) => {
          this.recomputing.set(false);
          this.preview.set(null);
          this.snackbar.success(this.translate.instant('laborReconciliation.recompute.applied', { count: result.entriesChanged }));
          this.load();
        },
        error: (err: HttpErrorResponse) => {
          this.recomputing.set(false);
          this.error.set(reason(err));
        },
      });
    });
  }

  protected hours(minutes: number | null | undefined): number | null {
    return minutes === null || minutes === undefined ? null : minutes / 60;
  }

  private range(): { from: string; to: string } | null {
    const from = toDateOnly(this.fromControl.value);
    const to = toDateOnly(this.toControl.value);
    return from && to ? { from, to } : null;
  }
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

function reason(err: HttpErrorResponse): string {
  return err?.error?.detail ?? err?.error?.title ?? err?.message ?? '';
}
