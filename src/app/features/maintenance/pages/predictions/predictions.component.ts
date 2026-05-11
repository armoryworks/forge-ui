import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PredictiveMaintenanceService } from '../../services/predictive-maintenance.service';
import {
  MaintenancePrediction,
  MaintenancePredictionSeverity,
  MaintenancePredictionStatus,
  PredictiveMaintenanceDashboard,
  ResolvePredictionRequest,
} from '../../models/prediction.model';
import {
  ResolvePredictionDialogComponent,
  ResolvePredictionDialogData,
} from '../../components/resolve-prediction-dialog/resolve-prediction-dialog.component';
import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

/**
 * Predictive maintenance alerts page. Top strip shows the dashboard KPIs
 * (active predictions, criticals, model accuracy); table below lists
 * predictions with per-row actions (acknowledge, schedule PM, resolve,
 * mark false-positive).
 *
 * Filters cascade: severity + status. Filter changes trigger a fresh
 * list request — most installs have small enough prediction volume to
 * make this round-trip free; if it grows to hundreds, switch to
 * server-side paging.
 */
@Component({
  selector: 'app-predictions',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, ReactiveFormsModule, TranslatePipe, MatTooltipModule,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    SelectComponent, DataTableComponent, ColumnCellDirective,
    LoadingBlockDirective,
  ],
  templateUrl: './predictions.component.html',
  styleUrl: './predictions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PredictionsComponent {
  private readonly service = inject(PredictiveMaintenanceService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly predictions = signal<MaintenancePrediction[]>([]);
  protected readonly dashboard = signal<PredictiveMaintenanceDashboard | null>(null);
  protected readonly loadingList = signal(true);
  protected readonly loadingDashboard = signal(true);

  protected readonly severityControl = new FormControl<string>('all', { nonNullable: true });
  protected readonly statusControl = new FormControl<string>('open', { nonNullable: true });

  protected readonly severityOptions: SelectOption[] = [
    { value: 'all', label: this.translate.instant('maintenance.severityAll') },
    { value: 'Critical', label: this.translate.instant('maintenance.severity.Critical') },
    { value: 'High', label: this.translate.instant('maintenance.severity.High') },
    { value: 'Medium', label: this.translate.instant('maintenance.severity.Medium') },
    { value: 'Low', label: this.translate.instant('maintenance.severity.Low') },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: 'all', label: this.translate.instant('maintenance.statusAll') },
    { value: 'open', label: this.translate.instant('maintenance.statusOpen') },
    { value: 'Predicted', label: this.translate.instant('maintenance.status.Predicted') },
    { value: 'Acknowledged', label: this.translate.instant('maintenance.status.Acknowledged') },
    { value: 'MaintenanceScheduled', label: this.translate.instant('maintenance.status.MaintenanceScheduled') },
    { value: 'Resolved', label: this.translate.instant('maintenance.status.Resolved') },
    { value: 'FalsePositive', label: this.translate.instant('maintenance.status.FalsePositive') },
    { value: 'Expired', label: this.translate.instant('maintenance.status.Expired') },
  ];

  protected readonly columns: ColumnDef[] = [
    { field: 'workCenterName', header: this.translate.instant('maintenance.colWorkCenter'), sortable: true },
    { field: 'predictionType', header: this.translate.instant('maintenance.colType'), sortable: true, width: '160px' },
    { field: 'severity', header: this.translate.instant('maintenance.colSeverity'), sortable: true, width: '110px' },
    { field: 'confidencePercent', header: this.translate.instant('maintenance.colConfidence'), sortable: true, type: 'number', align: 'right', width: '110px' },
    { field: 'predictedFailureDate', header: this.translate.instant('maintenance.colPredictedFailure'), sortable: true, type: 'date', width: '160px' },
    { field: 'status', header: this.translate.instant('common.status'), sortable: true, width: '140px' },
    { field: 'actions', header: '', width: '180px', align: 'right' },
  ];

  protected readonly filteredPredictions = computed(() => {
    const all = this.predictions();
    const sev = this.severityControl.value;
    const status = this.statusControl.value;
    return all.filter(p => {
      if (sev !== 'all' && p.severity !== sev) return false;
      if (status === 'open') {
        return p.status !== 'Resolved' && p.status !== 'FalsePositive' && p.status !== 'Expired';
      }
      if (status !== 'all' && p.status !== status) return false;
      return true;
    });
  });

  constructor() {
    this.load();
    this.severityControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.statusControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  protected load(): void {
    this.loadingList.set(true);
    this.loadingDashboard.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => { this.predictions.set(rows); this.loadingList.set(false); },
      error: () => this.loadingList.set(false),
    });
    this.service.getDashboard().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (d) => { this.dashboard.set(d); this.loadingDashboard.set(false); },
      error: () => this.loadingDashboard.set(false),
    });
  }

  protected getSeverityClass(severity: MaintenancePredictionSeverity): string {
    const map: Record<MaintenancePredictionSeverity, string> = {
      Critical: 'chip--error',
      High: 'chip--warning',
      Medium: 'chip--info',
      Low: 'chip--muted',
    };
    return `chip ${map[severity] ?? 'chip--muted'}`;
  }

  protected getStatusClass(status: MaintenancePredictionStatus): string {
    const map: Record<MaintenancePredictionStatus, string> = {
      Predicted: 'chip--warning',
      Acknowledged: 'chip--info',
      MaintenanceScheduled: 'chip--primary',
      Resolved: 'chip--success',
      FalsePositive: 'chip--muted',
      Expired: 'chip--muted',
    };
    return `chip ${map[status] ?? 'chip--muted'}`;
  }

  protected canAcknowledge(p: MaintenancePrediction): boolean {
    return p.status === 'Predicted';
  }

  protected canSchedule(p: MaintenancePrediction): boolean {
    return p.status === 'Predicted' || p.status === 'Acknowledged';
  }

  protected canResolve(p: MaintenancePrediction): boolean {
    return p.status !== 'Resolved' && p.status !== 'FalsePositive' && p.status !== 'Expired';
  }

  protected acknowledge(p: MaintenancePrediction): void {
    this.service.acknowledge(p.id).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('maintenance.acknowledged'));
        this.load();
      },
    });
  }

  protected schedule(p: MaintenancePrediction): void {
    this.service.scheduleMaintenance(p.id).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('maintenance.scheduled'));
        this.load();
      },
    });
  }

  protected resolve(p: MaintenancePrediction): void {
    this.openResolveDialog(p, 'resolve');
  }

  protected falsePositive(p: MaintenancePrediction): void {
    this.openResolveDialog(p, 'false-positive');
  }

  private openResolveDialog(p: MaintenancePrediction, mode: 'resolve' | 'false-positive'): void {
    this.dialog.open<ResolvePredictionDialogComponent, ResolvePredictionDialogData, ResolvePredictionRequest | undefined>(
      ResolvePredictionDialogComponent, { width: '480px', data: { mode } },
    ).afterClosed().subscribe(result => {
      if (!result) return;
      const obs = mode === 'resolve'
        ? this.service.resolve(p.id, result)
        : this.service.markFalsePositive(p.id, result);
      obs.subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant(mode === 'resolve' ? 'maintenance.resolved' : 'maintenance.markedFalsePositive'));
          this.load();
        },
      });
    });
  }
}
