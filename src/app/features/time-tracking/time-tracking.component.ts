import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { catchError, of, startWith } from 'rxjs';
import { TimeTrackingService } from './services/time-tracking.service';
import { TimeEntry } from './models/time-entry.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { DialogComponent } from '../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../shared/components/select/select.component';
import { TextareaComponent } from '../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../shared/components/toggle/toggle.component';
import { DatepickerComponent } from '../../shared/components/datepicker/datepicker.component';
import { DataTableComponent } from '../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../shared/models/column-def.model';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { EntityLinkComponent } from '../../shared/components/entity-link/entity-link.component';
import { DraftConfig } from '../../shared/models/draft-config.model';
import { toDateOnly } from '../../shared/utils/date.utils';
import { TimerHubService } from '../../shared/services/timer-hub.service';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { DraftResumeService } from '../../shared/services/draft-resume.service';
import { RunningTimersService } from '../../shared/services/running-timers.service';
import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { RunningTimersComponent } from '../../shared/components/running-timers/running-timers.component';
import { elapsedMs } from '../../shared/utils/elapsed-ms';
import { secondTicker } from '../../shared/utils/second-ticker';

function durationInRange(group: AbstractControl): ValidationErrors | null {
  const total = (Number(group.get('hours')?.value) || 0) * 60 + (Number(group.get('minutes')?.value) || 0);
  return total >= 1 && total <= 1440 ? null : { durationRange: true };
}

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
    ToggleComponent,
    DatepickerComponent,
    DataTableComponent,
    ColumnCellDirective,
    ValidationButtonComponent,
    EntityLinkComponent,
    TranslatePipe,
    MatTooltipModule,
    RunningTimersComponent,
  ],
  templateUrl: './time-tracking.component.html',
  styleUrl: './time-tracking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeTrackingComponent implements OnInit, OnDestroy {
  @ViewChild(DialogComponent) private dialogRef!: DialogComponent;

  private readonly service = inject(TimeTrackingService);
  private readonly timerHub = inject(TimerHubService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly draftResume = inject(DraftResumeService);
  private readonly runningTimers = inject(RunningTimersService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);

  protected readonly billableEnabled = computed(() => this.capabilities.isEnabled('CAP-PS-TIME-BILLABLE'));

  protected readonly loading = signal(false);
  protected readonly entries = signal<TimeEntry[]>([]);
  protected readonly activeTimers = signal<TimeEntry[]>([]);
  protected readonly activeTimer = computed(() => this.activeTimers().find(t => !t.jobOperationId) ?? null);
  private readonly now = secondTicker();
  protected readonly activeTimerElapsed = computed(() => this.timerElapsed(this.activeTimer()));
  protected readonly stopTargetElapsed = computed(() => this.timerElapsed(this.stopTarget()));
  protected readonly otherRunningTimers = computed(() => {
    const header = this.activeTimer();
    return this.activeTimers().filter(t => t !== header);
  });
  protected readonly stopTarget = signal<TimeEntry | null>(null);
  protected readonly saving = signal(false);
  protected draftConfig: DraftConfig = { entityType: 'time-entry', entityId: 'new', route: '/time-tracking' };

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
    isBillable: new FormControl(true, { nonNullable: true }),
  }, { validators: durationInRange });
  private readonly entryFieldViolations = FormValidationService.getViolations(this.entryForm, {
    date: 'Date',
    hours: 'Hours',
    minutes: 'Minutes',
  });
  private readonly entryStatus = toSignal(this.entryForm.statusChanges.pipe(startWith(this.entryForm.status)));
  protected readonly entryViolations = computed(() => {
    this.entryStatus();
    const fields = this.entryFieldViolations();
    return this.entryForm.hasError('durationRange')
      ? [...fields, this.translate.instant('timeTracking.durationRange')]
      : fields;
  });

  protected readonly today = new Date();

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
    return new Date(entry.date).getTime() >= today.getTime();
  }

  protected canChange(entry: TimeEntry): boolean {
    return entry.userId === this.auth.user()?.id || this.auth.hasAnyRole(['Admin', 'Manager']);
  }

  constructor() {
    this.loadEntries();
    this.initTimerHub();

    this.dateFromControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadEntries());
    this.dateToControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.loadEntries());
  }

  ngOnInit(): void {
    if (this.draftResume.consume('time-entry')) {
      this.openManualEntry();
    }
  }

  ngOnDestroy(): void {
    this.timerHub.clearCallbacks();
  }

  private async initTimerHub(): Promise<void> {
    await this.timerHub.connect();
    this.timerHub.onTimerStartedEvent((_event) => this.loadEntries());
    this.timerHub.onTimerStoppedEvent((_event) => this.loadEntries());
  }

  protected loadEntries(): void {
    this.loading.set(true);
    const from = toDateOnly(this.dateFromControl.value) ?? undefined;
    const to = toDateOnly(this.dateToControl.value) ?? undefined;
    this.service.getTimeEntries(undefined, undefined, from, to).subscribe({
      next: (entries) => {
        this.entries.set(entries);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.loadActiveTimers();
  }

  private loadActiveTimers(): void {
    this.runningTimers.getMine().pipe(
      catchError(() => of(null)),
    ).subscribe(timers => {
      if (timers) {
        this.activeTimers.set(timers.filter(t => t.timerStart && !t.timerStop));
        return;
      }
      const userId = this.auth.user()?.id;
      this.activeTimers.set(this.entries().filter(e => e.userId === userId && e.timerStart && !e.timerStop));
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
      isBillable: true,
    });
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected saveEntry(): void {
    if (this.entryForm.invalid || this.saving()) return;
    const form = this.entryForm.getRawValue();
    const duration = ((form.hours ?? 0) * 60) + (form.minutes ?? 0);
    if (duration <= 0) return;
    this.saving.set(true);
    this.service.createTimeEntry({
      date: toDateOnly(form.date) ?? new Date().toISOString().split('T')[0],
      durationMinutes: duration,
      category: form.category || undefined,
      notes: form.notes || undefined,
      isBillable: this.billableEnabled() ? form.isBillable : undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.dialogRef.clearDraft();
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
    if (this.saving()) return;
    const form = this.timerForm.getRawValue();
    this.saving.set(true);
    this.service.startTimer({
      category: form.category || undefined,
      notes: form.notes || undefined,
    }).subscribe({
      next: () => { this.saving.set(false); this.closeTimerDialog(); this.loadEntries(); this.snackbar.success(this.translate.instant('timeTracking.timerStarted')); },
      error: () => this.saving.set(false),
    });
  }

  protected openStopTimer(entry: TimeEntry | null = this.activeTimer()): void {
    if (!entry) return;
    this.stopTarget.set(entry);
    this.stopNotesControl.reset('');
    this.showStopDialog.set(true);
  }

  protected openStopTimerById(timeEntryId: number): void {
    this.openStopTimer(this.activeTimers().find(t => t.id === timeEntryId) ?? null);
  }

  protected closeStopDialog(): void {
    this.showStopDialog.set(false);
    this.stopTarget.set(null);
  }

  protected stopTimer(): void {
    const target = this.stopTarget();
    if (!target || this.saving()) return;
    this.saving.set(true);
    this.service.stopTimer({
      timeEntryId: target.id,
      notes: this.stopNotesControl.value || undefined,
    }).subscribe({
      next: () => { this.saving.set(false); this.closeStopDialog(); this.loadEntries(); this.snackbar.success(this.translate.instant('timeTracking.timerStopped')); },
      error: () => this.saving.set(false),
    });
  }

  protected formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  private timerElapsed(timer: TimeEntry | null): string {
    if (!timer?.timerStart) return '0m';
    return this.formatDuration(Math.floor(elapsedMs(timer.timerStart, this.now()) / 60000));
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
