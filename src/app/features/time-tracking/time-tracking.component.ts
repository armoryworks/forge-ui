import { ChangeDetectionStrategy, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { TimeTrackingService } from './services/time-tracking.service';
import { TimeEntry } from './models/time-entry.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { toIsoDate } from '../../shared/utils/date.utils';
import { TimerHubService } from '../../shared/services/timer-hub.service';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';

@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageHeaderComponent,
    DialogComponent,
    InputComponent,
    SelectComponent,
    TextareaComponent,
    DatepickerComponent,
    DataTableComponent,
    ColumnCellDirective,
    ValidationPopoverDirective,
    TranslatePipe,
    MatTooltipModule,
  ],
  templateUrl: './time-tracking.component.html',
  styleUrl: './time-tracking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeTrackingComponent implements OnDestroy {
  private readonly service = inject(TimeTrackingService);
  private readonly timerHub = inject(TimerHubService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = signal(false);
  protected readonly entries = signal<TimeEntry[]>([]);
  protected readonly activeTimer = signal<TimeEntry | null>(null);
  protected readonly saving = signal(false);

  // Page date filters
  protected readonly dateFromControl = new FormControl<Date | null>(null);
  protected readonly dateToControl = new FormControl<Date | null>(null);

  private readonly dateFrom$ = toSignal(this.dateFromControl.valueChanges.pipe(startWith(null)));
  private readonly dateTo$ = toSignal(this.dateToControl.valueChanges.pipe(startWith(null)));

  // Manual entry dialog
  protected readonly showDialog = signal(false);
  protected readonly entryForm = new FormGroup({
    date: new FormControl<Date | null>(new Date(), [Validators.required]),
    hours: new FormControl(0, [Validators.required, Validators.min(0), Validators.max(24)]),
    minutes: new FormControl(0, [Validators.required, Validators.min(0), Validators.max(59)]),
    category: new FormControl(''),
    notes: new FormControl(''),
  });
  protected readonly entryViolations = FormValidationService.getViolations(this.entryForm, {
    date: 'Date',
    hours: 'Hours',
    minutes: 'Minutes',
  });

  // Timer dialog
  protected readonly showTimerDialog = signal(false);
  protected readonly timerForm = new FormGroup({
    category: new FormControl(''),
    notes: new FormControl(''),
  });

  // Stop timer dialog
  protected readonly showStopDialog = signal(false);
  protected readonly stopNotesControl = new FormControl('');

  protected readonly categoryOptions: SelectOption[] = [
    { value: '', label: this.translate.instant('timeTracking.categoryNone') },
    { value: 'Production', label: this.translate.instant('timeTracking.categoryProduction') },
    { value: 'Setup', label: this.translate.instant('timeTracking.categorySetup') },
    { value: 'Inspection', label: this.translate.instant('timeTracking.categoryInspection') },
    { value: 'Maintenance', label: this.translate.instant('timeTracking.categoryMaintenance') },
    { value: 'Training', label: this.translate.instant('timeTracking.categoryTraining') },
    { value: 'Meeting', label: this.translate.instant('timeTracking.categoryMeeting') },
    { value: 'Admin', label: this.translate.instant('timeTracking.categoryAdmin') },
    { value: 'Cleanup', label: this.translate.instant('timeTracking.categoryCleanup') },
    { value: 'Other', label: this.translate.instant('timeTracking.categoryOther') },
  ];

  protected readonly timeColumns: ColumnDef[] = [
    { field: 'icon', header: '', width: '32px' },
    { field: 'date', header: this.translate.instant('timeTracking.colDate'), sortable: true, type: 'date' },
    { field: 'userName', header: this.translate.instant('timeTracking.colUser'), sortable: true },
    { field: 'jobNumber', header: this.translate.instant('timeTracking.colJob') },
    { field: 'category', header: this.translate.instant('timeTracking.colCategory'), sortable: true },
    { field: 'durationMinutes', header: this.translate.instant('timeTracking.colDuration'), sortable: true },
    { field: 'notes', header: this.translate.instant('timeTracking.colNotes') },
    { field: 'type', header: this.translate.instant('timeTracking.colType'), width: '80px' },
    { field: 'actions', header: '', width: '64px', align: 'right' },
  ];

  protected readonly timeRowClass = (row: unknown) => {
    const entry = row as TimeEntry;
    return entry.timerStart && !entry.timerStop ? 'row--active' : '';
  };

  protected isEditable(entry: TimeEntry): boolean {
    if (entry.isLocked) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return entry.date.getTime() >= today.getTime();
  }

  constructor() {
    this.loadEntries();
    this.initTimerHub();

    this.dateFromControl.valueChanges.subscribe(() => this.loadEntries());
    this.dateToControl.valueChanges.subscribe(() => this.loadEntries());
  }

  ngOnDestroy(): void {
    this.timerHub.disconnect();
  }

  private async initTimerHub(): Promise<void> {
    await this.timerHub.connect();
    this.timerHub.onTimerStartedEvent((_event) => this.loadEntries());
    this.timerHub.onTimerStoppedEvent((_event) => this.loadEntries());
  }

  protected loadEntries(): void {
    this.loading.set(true);
    const from = toIsoDate(this.dateFromControl.value) ?? undefined;
    const to = toIsoDate(this.dateToControl.value) ?? undefined;
    this.service.getTimeEntries(undefined, undefined, from, to).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        const timer = entries.find(e => e.timerStart && !e.timerStop);
        this.activeTimer.set(timer ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // Manual entry
  protected openManualEntry(): void {
    this.entryForm.reset({
      date: new Date(),
      hours: 0,
      minutes: 0,
      category: '',
      notes: '',
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void { this.showDialog.set(false); }

  protected saveEntry(): void {
    if (this.entryForm.invalid) return;
    const form = this.entryForm.getRawValue();
    const duration = ((form.hours ?? 0) * 60) + (form.minutes ?? 0);
    if (duration <= 0) return;
    this.saving.set(true);
    this.service.createTimeEntry({
      date: toIsoDate(form.date) ?? new Date().toISOString().split('T')[0],
      durationMinutes: duration,
      category: form.category || undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.loadEntries();
        this.snackbar.success(this.translate.instant('timeTracking.entryAdded'));
      },
      error: () => this.saving.set(false),
    });
  }

  // Timer
  protected openStartTimer(): void {
    this.timerForm.reset({ category: '', notes: '' });
    this.showTimerDialog.set(true);
  }

  protected closeTimerDialog(): void { this.showTimerDialog.set(false); }

  protected startTimer(): void {
    const form = this.timerForm.getRawValue();
    this.service.startTimer({
      category: form.category || undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => { this.closeTimerDialog(); this.loadEntries(); this.snackbar.success(this.translate.instant('timeTracking.timerStarted')); },
    });
  }

  protected openStopTimer(): void {
    this.stopNotesControl.reset('');
    this.showStopDialog.set(true);
  }

  protected closeStopDialog(): void { this.showStopDialog.set(false); }

  protected stopTimer(): void {
    this.service.stopTimer({
      notes: this.stopNotesControl.value || undefined,
    }).subscribe({
      next: () => { this.closeStopDialog(); this.loadEntries(); this.snackbar.success(this.translate.instant('timeTracking.timerStopped')); },
    });
  }

  protected formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  protected getTimerElapsed(): string {
    const timer = this.activeTimer();
    if (!timer?.timerStart) return '0m';
    const elapsed = Math.floor((Date.now() - timer.timerStart.getTime()) / 60000);
    return this.formatDuration(elapsed);
  }

  protected getTotalHours(): string {
    const total = this.entries().reduce((sum, e) => sum + e.durationMinutes, 0);
    return (total / 60).toFixed(1);
  }

  protected deleteTimeEntry(entry: TimeEntry): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('timeTracking.deleteTitle'),
        message: this.translate.instant('timeTracking.deleteMessage'),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.deleteTimeEntry(entry.id).subscribe({
        next: () => {
          this.loadEntries();
          this.snackbar.success(this.translate.instant('timeTracking.entryDeleted'));
        },
      });
    });
  }
}
