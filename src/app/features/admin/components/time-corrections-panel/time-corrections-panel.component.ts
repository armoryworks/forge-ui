import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';

import { TimeTrackingService } from '../../../time-tracking/services/time-tracking.service';
import { AdminService } from '../../services/admin.service';
import { TimeEntry } from '../../../time-tracking/models/time-entry.model';
import { TimeCorrectionLog } from '../../../time-tracking/models/time-correction-log.model';
import { CorrectTimeEntryRequest } from '../../../time-tracking/models/correct-time-entry-request.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { toIsoDate } from '../../../../shared/utils/date.utils';

@Component({
  selector: 'app-time-corrections-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DatePipe,
    DataTableComponent,
    ColumnCellDirective,
    InputComponent,
    SelectComponent,
    DatepickerComponent,
    TextareaComponent,
    DialogComponent,
    LoadingBlockDirective,
    ValidationPopoverDirective,
  ],
  templateUrl: './time-corrections-panel.component.html',
  styleUrl: './time-corrections-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimeCorrectionsPanelComponent implements OnInit {
  private readonly timeService = inject(TimeTrackingService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly entries = signal<TimeEntry[]>([]);
  protected readonly corrections = signal<TimeCorrectionLog[]>([]);
  protected readonly userOptions = signal<SelectOption[]>([]);

  // Filters
  protected readonly userControl = new FormControl<number | null>(null);
  protected readonly fromDateControl = new FormControl<Date | null>(null);
  protected readonly toDateControl = new FormControl<Date | null>(null);

  // Correction dialog
  protected readonly showDialog = signal(false);
  protected readonly editingEntry = signal<TimeEntry | null>(null);

  protected readonly correctionForm = new FormGroup({
    jobId: new FormControl<number | null>(null),
    date: new FormControl<Date | null>(null),
    startTime: new FormControl<string | null>(null),
    endTime: new FormControl<string | null>(null),
    category: new FormControl<string | null>(null),
    notes: new FormControl<string | null>(null),
    reason: new FormControl('', [Validators.required, Validators.minLength(3)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.correctionForm, {
    reason: 'Reason',
  });

  protected readonly calculatedDuration = signal<string>('');

  protected readonly entryColumns: ColumnDef[] = [
    { field: 'userName', header: 'Employee', sortable: true },
    { field: 'date', header: 'Date', sortable: true, type: 'date', width: '110px' },
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '120px' },
    { field: 'timerStart', header: 'Start', sortable: true, width: '100px' },
    { field: 'timerStop', header: 'End', sortable: true, width: '100px' },
    { field: 'durationMinutes', header: 'Duration', sortable: true, type: 'number', width: '100px' },
    { field: 'category', header: 'Category', sortable: true, width: '120px' },
    { field: 'notes', header: 'Notes', sortable: true },
    { field: 'actions', header: '', width: '60px' },
  ];

  protected readonly correctionColumns: ColumnDef[] = [
    { field: 'correctedByName', header: 'Corrected By', sortable: true },
    { field: 'createdAt', header: 'Date', sortable: true, type: 'date', width: '140px' },
    { field: 'timeEntryId', header: 'Entry ID', sortable: true, width: '90px' },
    { field: 'originalJobNumber', header: 'Orig. Job #', sortable: true, width: '110px' },
    { field: 'originalDate', header: 'Orig. Date', sortable: true, type: 'date', width: '110px' },
    { field: 'originalStartTime', header: 'Orig. Start', sortable: true, width: '100px' },
    { field: 'originalEndTime', header: 'Orig. End', sortable: true, width: '100px' },
    { field: 'originalDurationMinutes', header: 'Orig. Duration', sortable: true, type: 'number', width: '110px' },
    { field: 'reason', header: 'Reason', sortable: true },
  ];

  ngOnInit(): void {
    this.loadUsers();
    this.loadEntries();
    this.loadCorrections();

    this.userControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadEntries();
      this.loadCorrections();
    });
    this.fromDateControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadEntries();
      this.loadCorrections();
    });
    this.toDateControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.loadEntries();
      this.loadCorrections();
    });

    // Auto-calculate duration when start/end times change
    this.correctionForm.controls.startTime.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateCalculatedDuration());
    this.correctionForm.controls.endTime.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateCalculatedDuration());
  }

  private loadUsers(): void {
    this.adminService.getUsers().subscribe({
      next: (users) => {
        this.userOptions.set([
          { value: null, label: '-- All Employees --' },
          ...users.map(u => ({ value: u.id, label: `${u.lastName}, ${u.firstName}` })),
        ]);
      },
    });
  }

  protected loadEntries(): void {
    this.isLoading.set(true);
    const userId = this.userControl.value ?? undefined;
    const from = this.fromDateControl.value ? toIsoDate(this.fromDateControl.value) ?? undefined : undefined;
    const to = this.toDateControl.value ? toIsoDate(this.toDateControl.value) ?? undefined : undefined;
    this.timeService.getTimeEntries(userId, undefined, from, to).subscribe({
      next: (entries) => { this.entries.set(entries); this.isLoading.set(false); },
      error: () => { this.isLoading.set(false); },
    });
  }

  private loadCorrections(): void {
    const userId = this.userControl.value ?? undefined;
    const from = this.fromDateControl.value ? toIsoDate(this.fromDateControl.value) ?? undefined : undefined;
    const to = this.toDateControl.value ? toIsoDate(this.toDateControl.value) ?? undefined : undefined;
    this.timeService.getCorrections(userId, from, to).subscribe({
      next: (corrections) => this.corrections.set(corrections),
    });
  }

  protected openCorrection(entry: TimeEntry): void {
    this.editingEntry.set(entry);
    this.correctionForm.reset();
    this.correctionForm.patchValue({
      jobId: entry.jobId,
      date: entry.date ? new Date(entry.date) : null,
      startTime: entry.timerStart ? this.toTimeString(new Date(entry.timerStart)) : null,
      endTime: entry.timerStop ? this.toTimeString(new Date(entry.timerStop)) : null,
      category: entry.category,
      notes: entry.notes,
    });
    this.updateCalculatedDuration();
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
    this.editingEntry.set(null);
  }

  protected saveCorrection(): void {
    const entry = this.editingEntry();
    if (!entry || this.correctionForm.invalid) return;

    this.saving.set(true);
    const val = this.correctionForm.getRawValue();
    const request: CorrectTimeEntryRequest = {
      reason: val.reason!,
    };

    // Only include fields that changed
    if (val.jobId !== entry.jobId) request.jobId = val.jobId;
    if (val.date && toIsoDate(val.date) !== toIsoDate(new Date(entry.date))) request.date = toIsoDate(val.date);

    const origStartStr = entry.timerStart ? this.toTimeString(new Date(entry.timerStart)) : null;
    const origEndStr = entry.timerStop ? this.toTimeString(new Date(entry.timerStop)) : null;

    if (val.startTime !== origStartStr || val.endTime !== origEndStr) {
      // Build full DateTimeOffset from date + time
      const dateVal = val.date ?? new Date(entry.date);
      if (val.startTime) request.startTime = this.combineDateTime(dateVal, val.startTime);
      if (val.endTime) request.endTime = this.combineDateTime(dateVal, val.endTime);
    }

    if (val.category !== entry.category) request.category = val.category;
    if (val.notes !== entry.notes) request.notes = val.notes;

    this.timeService.correctTimeEntry(entry.id, request).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.loadEntries();
        this.loadCorrections();
        this.snackbar.success('Time entry corrected');
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  protected formatTime(dateStr: Date | string | null): string {
    if (!dateStr) return '--';
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private toTimeString(date: Date): string {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  private combineDateTime(date: Date, time: string): string {
    const [h, m] = time.split(':').map(Number);
    const combined = new Date(date);
    combined.setHours(h, m, 0, 0);
    return combined.toISOString();
  }

  private updateCalculatedDuration(): void {
    const start = this.correctionForm.controls.startTime.value;
    const end = this.correctionForm.controls.endTime.value;
    if (start && end) {
      const [sh, sm] = start.split(':').map(Number);
      const [eh, em] = end.split(':').map(Number);
      const minutes = (eh * 60 + em) - (sh * 60 + sm);
      this.calculatedDuration.set(minutes > 0 ? this.formatDuration(minutes) : '--');
    } else {
      this.calculatedDuration.set('');
    }
  }
}
