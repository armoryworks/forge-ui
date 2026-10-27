import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AdminService } from '../services/admin.service';
import { ScheduledTask } from '../models/scheduled-task.model';
import { PageLayoutComponent } from '../../../shared/components/page-layout/page-layout.component';
import { ToolbarComponent } from '../../../shared/components/toolbar/toolbar.component';
import { SpacerDirective } from '../../../shared/directives/spacer.directive';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { CronScheduleFieldsComponent } from '../../../shared/components/cron-schedule-fields/cron-schedule-fields.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ReferenceDataService } from '../../../shared/services/reference-data.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { DateTimePipe } from '../../../shared/pipes/date-time.pipe';
import { describeCron } from '../../../shared/utils/cron-schedule';
import { createCronScheduleForm, cronFromForm, loadCronScheduleForm } from '../../../shared/utils/cron-schedule-form';

/**
 * Scheduled tasks — recurring internal jobs (inspections, audits, PM rounds) created on a cron
 * schedule. Lists each task with its plain-language schedule, next and last run, and lets the
 * admin create, edit, pause, run now or delete.
 */
@Component({
  selector: 'app-scheduled-tasks',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateTimePipe,
    PageLayoutComponent, ToolbarComponent, SpacerDirective,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    ValidationButtonComponent, CronScheduleFieldsComponent, LoadingBlockDirective,
  ],
  templateUrl: './scheduled-tasks.component.html',
  styleUrl: './scheduled-tasks.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduledTasksComponent {
  private readonly admin = inject(AdminService);
  private readonly referenceData = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tasks = signal<ScheduledTask[]>([]);
  protected readonly trackTypeOptions = signal<SelectOption[]>([]);
  protected readonly projectTypeOptions = signal<SelectOption[]>([]);
  protected readonly assigneeOptions = signal<SelectOption[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly showEditor = signal(false);
  protected readonly editing = signal<ScheduledTask | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'name', header: this.translate.instant('scheduledTasksAdmin.cols.name'), sortable: true },
    { field: 'trackTypeName', header: this.translate.instant('scheduledTasksAdmin.cols.taskType'), sortable: true, width: '160px' },
    { field: 'schedule', header: this.translate.instant('scheduledTasksAdmin.cols.schedule') },
    { field: 'nextRunAt', header: this.translate.instant('scheduledTasksAdmin.cols.nextRun'), sortable: true, type: 'date', width: '170px' },
    { field: 'lastRunAt', header: this.translate.instant('scheduledTasksAdmin.cols.lastRun'), sortable: true, type: 'date', width: '170px' },
    { field: 'isActive', header: this.translate.instant('scheduledTasksAdmin.cols.status'), width: '100px', align: 'center' },
    { field: 'actions', header: '', width: '190px', align: 'right' },
  ];

  protected readonly scheduleForm = createCronScheduleForm();

  protected readonly form = new FormGroup({
    name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    trackTypeId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    internalProjectTypeId: new FormControl<number | null>(null),
    assigneeId: new FormControl<number | null>(null),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('scheduledTasksAdmin.fieldName'),
    trackTypeId: this.translate.instant('scheduledTasksAdmin.fieldTaskType'),
  });

  constructor() {
    this.load();
    this.admin.getTrackTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (types) => this.trackTypeOptions.set(types.map(t => ({ value: t.id, label: t.name }))),
    });
    this.admin.getPeople().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (users) => this.assigneeOptions.set([
        { value: null, label: this.translate.instant('scheduledTasksAdmin.unassigned') },
        ...users.filter(u => u.isActive).map(u => ({ value: u.id, label: `${u.firstName} ${u.lastName}`.trim() })),
      ]),
    });
    this.referenceData.getByGroup('internal_project_type').pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (items) => this.projectTypeOptions.set([
        { value: null, label: this.translate.instant('common.none') },
        ...items.filter(i => i.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(i => ({ value: i.id, label: i.label })),
      ]),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.admin.getScheduledTasks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.tasks.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected scheduleText(row: ScheduledTask): string {
    const d = describeCron(row.cronExpression);
    const day = d.dayKey ? this.translate.instant(d.dayKey) : '';
    return this.translate.instant(d.key, { ...d.params, day });
  }

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset({ name: '', description: '', trackTypeId: null, internalProjectTypeId: null, assigneeId: null, isActive: true });
    loadCronScheduleForm(this.scheduleForm, null);
    this.showEditor.set(true);
  }

  protected openEdit(row: ScheduledTask): void {
    this.editing.set(row);
    this.form.reset({
      name: row.name,
      description: row.description ?? '',
      trackTypeId: row.trackTypeId,
      internalProjectTypeId: row.internalProjectTypeId,
      assigneeId: row.assigneeId,
      isActive: row.isActive,
    });
    loadCronScheduleForm(this.scheduleForm, row.cronExpression);
    this.showEditor.set(true);
  }

  protected closeEditor(): void {
    this.showEditor.set(false);
    this.editing.set(null);
  }

  protected save(): void {
    const cronExpression = cronFromForm(this.scheduleForm);
    if (this.form.invalid || this.scheduleForm.invalid || !cronExpression) return;
    const f = this.form.getRawValue();
    const editing = this.editing();
    const body = {
      name: f.name.trim(),
      description: f.description.trim() || undefined,
      trackTypeId: f.trackTypeId!,
      internalProjectTypeId: f.internalProjectTypeId ?? undefined,
      assigneeId: f.assigneeId ?? undefined,
      cronExpression,
    };
    this.saving.set(true);
    const request$ = editing
      ? this.admin.updateScheduledTask(editing.id, { ...body, isActive: f.isActive })
      : this.admin.createScheduledTask(body);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(editing ? 'scheduledTasksAdmin.updated' : 'scheduledTasksAdmin.created'));
        this.closeEditor();
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'scheduledTasksAdmin.saveFailed');
      },
    });
  }

  protected toggleActive(row: ScheduledTask): void {
    this.busyId.set(row.id);
    this.admin.updateScheduledTask(row.id, { isActive: !row.isActive }).subscribe({
      next: () => {
        this.busyId.set(null);
        this.snackbar.success(this.translate.instant(row.isActive ? 'scheduledTasksAdmin.paused' : 'scheduledTasksAdmin.resumed'));
        this.load();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.snackbar.errorFrom(err, 'scheduledTasksAdmin.saveFailed');
      },
    });
  }

  protected runNow(row: ScheduledTask): void {
    this.busyId.set(row.id);
    this.admin.runScheduledTask(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.snackbar.success(this.translate.instant('scheduledTasksAdmin.ran', { name: row.name }));
        this.load();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.snackbar.errorFrom(err, 'scheduledTasksAdmin.runFailed');
      },
    });
  }

  protected confirmDelete(row: ScheduledTask): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '420px',
      data: {
        title: this.translate.instant('scheduledTasksAdmin.deleteTitle'),
        message: this.translate.instant('scheduledTasksAdmin.deleteConfirm', { name: row.name }),
        confirmLabel: this.translate.instant('common.delete'),
        cancelLabel: this.translate.instant('common.cancel'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.admin.deleteScheduledTask(row.id).subscribe({
        next: () => {
          this.snackbar.success(this.translate.instant('scheduledTasksAdmin.deleted'));
          this.load();
        },
        error: (err: unknown) => this.snackbar.errorFrom(err, 'scheduledTasksAdmin.deleteFailed'),
      });
    });
  }
}
