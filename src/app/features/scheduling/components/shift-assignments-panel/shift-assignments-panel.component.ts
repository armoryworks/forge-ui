import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToolbarComponent } from '../../../../shared/components/toolbar/toolbar.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { formatDate, toDateOnly } from '../../../../shared/utils/date.utils';
import { ShiftAssignment } from '../../../time-tracking/models/shift-assignment.model';
import { TimeTrackingService } from '../../../time-tracking/services/time-tracking.service';
import { Shift } from '../../models/scheduling.model';
import { SchedulingService } from '../../services/scheduling.service';

@Component({
  selector: 'app-shift-assignments-panel',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DataTableComponent, ColumnCellDirective, DatepickerComponent, DialogComponent,
    EmptyStateComponent, InputComponent, SelectComponent, TextareaComponent, ToolbarComponent, SpacerDirective,
    LoadingBlockDirective, ValidationButtonComponent,
  ],
  templateUrl: './shift-assignments-panel.component.html',
  styleUrl: './shift-assignments-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShiftAssignmentsPanelComponent implements OnInit {
  private readonly timeTracking = inject(TimeTrackingService);
  private readonly scheduling = inject(SchedulingService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly shifts = input<Shift[]>([]);

  protected readonly canEdit = computed(() => this.auth.hasRole('Admin'));
  protected readonly assignments = signal<ShiftAssignment[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly showDialog = signal(false);
  protected readonly userOptions = signal<SelectOption[]>([]);
  protected readonly shiftOptions = computed<SelectOption[]>(() =>
    this.shifts().filter(s => s.isActive).map(s => ({ value: s.id, label: s.name })),
  );

  protected readonly form = new FormGroup({
    userId: new FormControl<number | null>(null, [Validators.required]),
    shiftId: new FormControl<number | null>(null, [Validators.required]),
    effectiveFrom: new FormControl<Date | null>(new Date(), [Validators.required]),
    effectiveTo: new FormControl<Date | null>(null),
    shiftDifferentialRate: new FormControl<number | null>(null, [Validators.min(0)]),
    notes: new FormControl('', [Validators.maxLength(500)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    userId: this.translate.instant('scheduling.assignments.person'),
    shiftId: this.translate.instant('scheduling.assignments.shift'),
    effectiveFrom: this.translate.instant('scheduling.assignments.from'),
    shiftDifferentialRate: this.translate.instant('scheduling.assignments.differential'),
  });

  protected readonly columns = computed<ColumnDef[]>(() => [
    { field: 'userName', header: this.translate.instant('scheduling.assignments.person'), sortable: true },
    { field: 'shiftName', header: this.translate.instant('scheduling.assignments.shift'), sortable: true, filterable: true, type: 'text' },
    { field: 'effectiveFrom', header: this.translate.instant('scheduling.assignments.from'), sortable: true, type: 'date', width: '120px' },
    { field: 'effectiveTo', header: this.translate.instant('scheduling.assignments.to'), sortable: true, type: 'date', width: '120px' },
    { field: 'shiftDifferentialRate', header: this.translate.instant('scheduling.assignments.differential'), sortable: true, type: 'number', width: '140px', align: 'right' },
    { field: 'notes', header: this.translate.instant('scheduling.assignments.notes') },
    ...(this.canEdit() ? [{ field: 'actions', header: '', width: '64px', align: 'right' } as ColumnDef] : []),
  ]);

  protected readonly formatDate = formatDate;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.timeTracking.getShiftAssignments().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => { this.assignments.set(rows); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected openAssign(): void {
    this.form.reset({ userId: null, shiftId: null, effectiveFrom: new Date(), effectiveTo: null, shiftDifferentialRate: null, notes: '' });
    if (this.userOptions().length === 0) {
      this.scheduling.getUsers().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: users => this.userOptions.set(users.map(u => ({ value: u.id, label: u.name }))),
      });
    }
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.timeTracking.createShiftAssignment({
      userId: v.userId!,
      shiftId: v.shiftId!,
      effectiveFrom: toDateOnly(v.effectiveFrom)!,
      effectiveTo: toDateOnly(v.effectiveTo) ?? undefined,
      shiftDifferentialRate: v.shiftDifferentialRate ?? undefined,
      notes: v.notes?.trim() || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.load();
        this.snackbar.success(this.translate.instant('scheduling.assignments.saved'));
      },
      error: () => this.saving.set(false),
    });
  }

  protected remove(row: ShiftAssignment): void {
    this.dialog.open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('scheduling.assignments.removeTitle'),
        message: this.translate.instant('scheduling.assignments.removeMessage', { name: row.userName, shift: row.shiftName }),
        confirmLabel: this.translate.instant('scheduling.assignments.remove'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.timeTracking.deleteShiftAssignment(row.id).subscribe({
        next: () => {
          this.load();
          this.snackbar.success(this.translate.instant('scheduling.assignments.removed'));
        },
      });
    });
  }
}
