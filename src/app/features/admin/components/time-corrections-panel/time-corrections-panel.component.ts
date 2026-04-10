import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
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
export class TimeCorrectionsPanelComponent {
  private readonly timeService = inject(TimeTrackingService);
  private readonly adminService = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);

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
    durationMinutes: new FormControl<number | null>(null),
    category: new FormControl<string | null>(null),
    notes: new FormControl<string | null>(null),
    reason: new FormControl('', [Validators.required, Validators.minLength(3)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.correctionForm, {
    reason: 'Reason',
  });

  protected readonly entryColumns: ColumnDef[] = [
    { field: 'userName', header: 'Employee', sortable: true },
    { field: 'date', header: 'Date', sortable: true, type: 'date', width: '110px' },
    { field: 'jobNumber', header: 'Job #', sortable: true, width: '120px' },
    { field: 'durationMinutes', header: 'Duration (min)', sortable: true, type: 'number', width: '120px' },
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
    { field: 'originalDurationMinutes', header: 'Orig. Duration', sortable: true, type: 'number', width: '110px' },
    { field: 'reason', header: 'Reason', sortable: true },
  ];

  constructor() {
    this.loadUsers();
    this.loadEntries();
    this.loadCorrections();

    // Reload when filters change
    effect(() => {
      this.userControl.valueChanges.subscribe(() => {
        this.loadEntries();
        this.loadCorrections();
      });
      this.fromDateControl.valueChanges.subscribe(() => {
        this.loadEntries();
        this.loadCorrections();
      });
      this.toDateControl.valueChanges.subscribe(() => {
        this.loadEntries();
        this.loadCorrections();
      });
    });
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
      durationMinutes: entry.durationMinutes,
      category: entry.category,
      notes: entry.notes,
    });
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
    if (val.durationMinutes !== entry.durationMinutes) request.durationMinutes = val.durationMinutes;
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
}
