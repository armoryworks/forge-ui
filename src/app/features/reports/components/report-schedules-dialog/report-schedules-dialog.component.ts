import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { CronScheduleFieldsComponent } from '../../../../shared/components/cron-schedule-fields/cron-schedule-fields.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { describeCron } from '../../../../shared/utils/cron-schedule';
import { createCronScheduleForm, cronFromForm } from '../../../../shared/utils/cron-schedule-form';
import { ReportBuilderService } from '../../services/report-builder.service';
import { ReportExportFormat, ReportSchedule } from '../../models/report-schedule.model';

export interface ReportSchedulesDialogData {
  reportId: number;
  reportName: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+$/;

export function parseRecipients(value: string): string[] {
  return [...new Set(value.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.length > 0))];
}

function recipientsValid(control: AbstractControl<string>): ValidationErrors | null {
  const recipients = parseRecipients(control.value ?? '');
  if (recipients.length === 0) return { required: true };
  return recipients.every(r => EMAIL.test(r)) ? null : { email: true };
}

@Component({
  selector: 'app-report-schedules-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DateTimePipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent, CronScheduleFieldsComponent,
  ],
  templateUrl: './report-schedules-dialog.component.html',
  styleUrl: './report-schedules-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportSchedulesDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ReportSchedulesDialogComponent>);
  protected readonly data = inject<ReportSchedulesDialogData>(MAT_DIALOG_DATA);
  private readonly service = inject(ReportBuilderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly schedules = signal<ReportSchedule[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly busyId = signal<number | null>(null);
  protected readonly adding = signal(false);

  protected readonly formatOptions: SelectOption[] = [
    { value: 'Pdf', label: 'PDF' },
    { value: 'Csv', label: 'CSV' },
    { value: 'Xlsx', label: 'Excel (XLSX)' },
  ];

  protected readonly scheduleForm = createCronScheduleForm();

  protected readonly form = new FormGroup({
    recipients: new FormControl<string>('', { nonNullable: true, validators: [recipientsValid] }),
    format: new FormControl<ReportExportFormat>('Pdf', { nonNullable: true, validators: [Validators.required] }),
    subjectTemplate: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    recipients: this.translate.instant('reportSchedules.fieldRecipients'),
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getSchedules().subscribe({
      next: (rows) => {
        this.schedules.set(rows.filter(r => r.savedReportId === this.data.reportId));
        this.loading.set(false);
        if (this.schedules().length === 0) this.startAdding();
      },
      error: () => this.loading.set(false),
    });
  }

  protected recipients(row: ReportSchedule): string {
    try {
      const parsed: unknown = JSON.parse(row.recipientEmailsJson);
      return Array.isArray(parsed) ? parsed.join(', ') : '';
    } catch {
      return '';
    }
  }

  protected scheduleText(row: ReportSchedule): string {
    const d = describeCron(row.cronExpression);
    const day = d.dayKey ? this.translate.instant(d.dayKey) : '';
    return this.translate.instant(d.key, { ...d.params, day });
  }

  protected startAdding(): void {
    this.form.reset({ recipients: '', format: 'Pdf', subjectTemplate: this.data.reportName });
    this.scheduleForm.reset();
    this.adding.set(true);
  }

  protected cancelAdding(): void {
    this.adding.set(false);
  }

  protected save(): void {
    const cronExpression = cronFromForm(this.scheduleForm);
    if (this.form.invalid || this.scheduleForm.invalid || !cronExpression) return;
    const f = this.form.getRawValue();
    this.saving.set(true);
    this.service.createSchedule({
      savedReportId: this.data.reportId,
      cronExpression,
      recipientEmailsJson: JSON.stringify(parseRecipients(f.recipients)),
      format: f.format,
      subjectTemplate: f.subjectTemplate.trim() || null,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.adding.set(false);
        this.snackbar.success(this.translate.instant('reportSchedules.created'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'reportSchedules.saveFailed');
      },
    });
  }

  protected runNow(row: ReportSchedule): void {
    this.busyId.set(row.id);
    this.service.runScheduleNow(row.id).subscribe({
      next: (result) => {
        this.busyId.set(null);
        this.snackbar.success(this.translate.instant('reportSchedules.sent', { count: result.recipientCount }));
        this.load();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.snackbar.errorFrom(err, 'reportSchedules.runFailed');
      },
    });
  }

  protected remove(row: ReportSchedule): void {
    this.busyId.set(row.id);
    this.service.deleteSchedule(row.id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.snackbar.success(this.translate.instant('reportSchedules.deleted'));
        this.load();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.snackbar.errorFrom(err, 'reportSchedules.deleteFailed');
      },
    });
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
