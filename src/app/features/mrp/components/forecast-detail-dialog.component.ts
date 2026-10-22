import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { DATE_FORMAT, fromIsoDate } from '../../../shared/utils/date.utils';
import { MrpService } from '../services/mrp.service';
import { DemandForecast, ForecastBucket } from '../models/mrp.model';

export interface ForecastDetailDialogData {
  forecast: DemandForecast;
}

export type ForecastDetailDialogResult = 'approve' | 'changed' | undefined;

interface ForecastRow {
  id: string;
  bucket: ForecastBucket;
  period: Date | null;
  isForecast: boolean;
  override: FormControl<number | null> | null;
}

/**
 * Read-only view of one demand forecast's history and forecast buckets, with the
 * actions its status allows: override forecast periods (Draft/Approved), approve
 * (Draft) and apply to a draft master schedule (Approved).
 */
@Component({
  selector: 'app-forecast-detail-dialog',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, LoadingBlockDirective, DataTableComponent, ColumnCellDirective,
  ],
  templateUrl: './forecast-detail-dialog.component.html',
  styleUrl: './forecast-detail-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForecastDetailDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ForecastDetailDialogComponent, ForecastDetailDialogResult>);
  private readonly data = inject<ForecastDetailDialogData>(MAT_DIALOG_DATA);
  private readonly mrpService = inject(MrpService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly dateFormat = DATE_FORMAT;
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly forecast = signal<DemandForecast>(this.data.forecast);
  protected readonly rows = signal<ForecastRow[]>([]);
  protected readonly columns: ColumnDef[] = [
    { field: 'period', header: this.translate.instant('mrp.forecastDetail.period'), width: '120px' },
    { field: 'historical', header: this.translate.instant('mrp.forecastDetail.historical'), align: 'right' },
    { field: 'forecasted', header: this.translate.instant('mrp.forecastDetail.forecasted'), align: 'right' },
    { field: 'override', header: this.translate.instant('mrp.forecastDetail.override'), width: '180px' },
  ];
  protected readonly scheduleOptions = signal<SelectOption[]>([]);
  protected readonly scheduleControl = new FormControl<number | null>(null, Validators.required);

  protected readonly canOverride = computed(() => ['Draft', 'Approved'].includes(this.forecast().status));
  protected readonly canApprove = computed(() => this.forecast().status === 'Draft');
  protected readonly canApply = computed(() => this.forecast().status === 'Approved');

  private changed = false;

  constructor() {
    this.load();
    if (this.data.forecast.status === 'Approved') {
      this.mrpService.getMasterSchedules('Draft').subscribe(schedules =>
        this.scheduleOptions.set(schedules.map(s => ({ value: s.id, label: s.name }))));
    }
  }

  protected saveOverrides(): void {
    const edits = this.rows().filter(r => r.override?.dirty && r.override.valid && r.override.value !== null);
    if (edits.length === 0) return;
    this.saving.set(true);
    forkJoin(edits.map(r =>
      this.mrpService.createForecastOverride(this.forecast().id, r.bucket.periodStart, r.override!.value!),
    )).subscribe({
      next: () => {
        this.saving.set(false);
        this.changed = true;
        this.snackbar.success(this.translate.instant('mrp.forecastDetail.overridesSaved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected applyToSchedule(): void {
    const scheduleId = this.scheduleControl.value;
    if (scheduleId === null) return;
    this.saving.set(true);
    this.mrpService.applyForecastToMps(this.forecast().id, scheduleId).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('mrp.forecastDetail.applied'));
        this.dialogRef.close('changed');
      },
      error: () => this.saving.set(false),
    });
  }

  protected hasUnsavedOverrides(): boolean {
    return this.rows().some(r => r.override?.dirty === true);
  }

  protected approve(): void {
    this.dialogRef.close('approve');
  }

  protected close(): void {
    this.dialogRef.close(this.changed ? 'changed' : undefined);
  }

  private load(): void {
    this.loading.set(true);
    this.mrpService.getForecast(this.data.forecast.id).subscribe({
      next: (detail) => {
        this.forecast.set(detail);
        const start = fromIsoDate(detail.forecastStartDate);
        const editable = ['Draft', 'Approved'].includes(detail.status);
        this.rows.set((detail.forecastBuckets ?? []).map(bucket => {
          const period = fromIsoDate(bucket.periodStart);
          const isForecast = bucket.historicalQuantity === null && !!period && !!start && period >= start;
          return {
            id: bucket.periodStart,
            bucket,
            period,
            isForecast,
            override: isForecast && editable
              ? new FormControl<number | null>(bucket.overrideQuantity, Validators.min(0))
              : null,
          };
        }));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
