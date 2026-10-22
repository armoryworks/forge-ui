import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, formatNumber } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MaintenanceSchedulesService } from '../../services/maintenance-schedules.service';
import { MaintenanceSchedule } from '../../models/maintenance-schedule.model';
import { AssetsService } from '../../../assets/services/assets.service';
import { PageHeaderComponent } from '../../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-maintenance-schedules',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, TranslatePipe, MatTooltipModule,
    PageHeaderComponent, DataTableComponent, ColumnCellDirective, LoadingBlockDirective,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, DatepickerComponent,
    ValidationButtonComponent,
  ],
  templateUrl: './schedules.component.html',
  styleUrl: './schedules.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchedulesComponent {
  private readonly service = inject(MaintenanceSchedulesService);
  private readonly assetsService = inject(AssetsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly locale = inject(LOCALE_ID);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly schedules = signal<MaintenanceSchedule[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly assetOptions = signal<SelectOption[]>([]);
  protected readonly showCreateDialog = signal(false);
  protected readonly loggingSchedule = signal<MaintenanceSchedule | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'assetName', header: this.translate.instant('maintenanceSchedules.colAsset'), sortable: true },
    { field: 'title', header: this.translate.instant('maintenanceSchedules.colTitle'), sortable: true },
    { field: 'interval', header: this.translate.instant('maintenanceSchedules.colInterval'), width: '220px' },
    { field: 'lastPerformedAt', header: this.translate.instant('maintenanceSchedules.colLastPerformed'), sortable: true, type: 'date', width: '130px' },
    { field: 'nextDueAt', header: this.translate.instant('maintenanceSchedules.colNextDue'), sortable: true, type: 'date', width: '130px' },
    { field: 'isOverdue', header: this.translate.instant('common.status'), sortable: true, width: '110px' },
    { field: 'actions', header: '', width: '100px', align: 'right' },
  ];

  protected readonly createForm = new FormGroup({
    assetId: new FormControl<number | null>(null, [Validators.required]),
    title: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    intervalDays: new FormControl<number | null>(30, [Validators.required, Validators.min(1)]),
    intervalHours: new FormControl<number | null>(null, [Validators.min(0.01)]),
    intervalShots: new FormControl<number | null>(null, [Validators.min(1)]),
    nextDueAt: new FormControl<Date | null>(null, [Validators.required]),
  });

  protected readonly logForm = new FormGroup({
    hoursAtService: new FormControl<number | null>(null, [Validators.min(0)]),
    shotCountAtService: new FormControl<number | null>(null, [Validators.min(0)]),
    cost: new FormControl<number | null>(null, [Validators.min(0)]),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly createViolations = FormValidationService.getViolations(this.createForm, {
    assetId: this.translate.instant('maintenanceSchedules.asset'),
    title: this.translate.instant('maintenanceSchedules.title'),
    intervalDays: this.translate.instant('maintenanceSchedules.intervalDays'),
    intervalHours: this.translate.instant('maintenanceSchedules.intervalHours'),
    intervalShots: this.translate.instant('maintenanceSchedules.intervalShots'),
    nextDueAt: this.translate.instant('maintenanceSchedules.nextDueAt'),
  });

  protected readonly logViolations = FormValidationService.getViolations(this.logForm, {
    hoursAtService: this.translate.instant('maintenanceSchedules.hoursAtService'),
    shotCountAtService: this.translate.instant('maintenanceSchedules.shotCountAtService'),
    cost: this.translate.instant('maintenanceSchedules.cost'),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { this.schedules.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.createForm.reset({ assetId: null, title: '', description: '', intervalDays: 30, intervalHours: null, intervalShots: null, nextDueAt: null });
    this.showCreateDialog.set(true);
    this.assetsService.getAssets(undefined, 'Active').subscribe({
      next: assets => this.assetOptions.set(assets.map(a => ({ value: a.id, label: a.name }))),
    });
  }

  protected saveSchedule(): void {
    if (this.createForm.invalid) return;
    const form = this.createForm.getRawValue();
    this.saving.set(true);
    this.service.create({
      assetId: form.assetId!,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      intervalDays: form.intervalDays!,
      intervalHours: form.intervalHours ?? undefined,
      intervalShots: form.intervalShots ?? undefined,
      nextDueAt: toIsoDate(form.nextDueAt)!,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showCreateDialog.set(false);
        this.snackbar.success(this.translate.instant('maintenanceSchedules.created'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected openLog(schedule: MaintenanceSchedule): void {
    this.logForm.reset({ hoursAtService: null, shotCountAtService: null, cost: null, notes: '' });
    this.loggingSchedule.set(schedule);
  }

  protected saveLog(): void {
    const schedule = this.loggingSchedule();
    if (!schedule || this.logForm.invalid) return;
    const form = this.logForm.getRawValue();
    this.saving.set(true);
    this.service.logService(schedule.id, {
      hoursAtService: form.hoursAtService ?? undefined,
      shotCountAtService: form.shotCountAtService ?? undefined,
      cost: form.cost ?? undefined,
      notes: form.notes.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.loggingSchedule.set(null);
        this.snackbar.success(this.translate.instant('maintenanceSchedules.logged'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected createJob(schedule: MaintenanceSchedule): void {
    this.service.createJob(schedule.id).subscribe({
      next: ({ jobId }) => {
        this.snackbar.success(this.translate.instant('maintenanceSchedules.jobCreated'));
        this.router.navigate(['/kanban'], { queryParams: { detail: `job:${jobId}` } });
      },
    });
  }

  protected intervalParts(schedule: MaintenanceSchedule): string[] {
    const parts = [this.translate.instant('maintenanceSchedules.everyDays', { count: schedule.intervalDays })];
    if (schedule.intervalHours) parts.push(this.translate.instant('maintenanceSchedules.everyHours', { count: schedule.intervalHours }));
    if (schedule.intervalShots) parts.push(this.translate.instant('maintenanceSchedules.everyShots', { count: formatNumber(schedule.intervalShots, this.locale) }));
    return parts;
  }
}
