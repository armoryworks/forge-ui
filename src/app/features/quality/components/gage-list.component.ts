import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { QualityService } from '../services/quality.service';
import { Gage, GageStatus, CalibrationRecord } from '../models/gage.model';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { SelectOption } from '../../../shared/components/select/select.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../shared/components/datepicker/datepicker.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';
import { ValidationPopoverDirective } from '../../../shared/directives/validation-popover.directive';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../shared/utils/date.utils';

@Component({
  selector: 'app-gage-list',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule,
    DataTableComponent, DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    DatepickerComponent, EmptyStateComponent, LoadingBlockDirective, ValidationPopoverDirective,
    ColumnCellDirective,
  ],
  templateUrl: './gage-list.component.html',
  styleUrl: './gage-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GageListComponent {
  private readonly qualityService = inject(QualityService);
  private readonly snackbar = inject(SnackbarService);

  protected readonly gages = signal<Gage[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  // Create dialog
  protected readonly showCreateDialog = signal(false);

  // Detail dialog
  protected readonly selectedGage = signal<Gage | null>(null);
  protected readonly showDetailDialog = signal(false);
  protected readonly calibrations = signal<CalibrationRecord[]>([]);
  protected readonly calibrationLoading = signal(false);

  // Calibration dialog
  protected readonly showCalDialog = signal(false);
  protected readonly calSaving = signal(false);

  // Filter
  protected readonly searchControl = new FormControl('');
  protected readonly statusFilter = new FormControl<GageStatus | null>(null);

  protected readonly columns: ColumnDef[] = [
    { field: 'gageNumber', header: 'Gage #', sortable: true, width: '110px' },
    { field: 'description', header: 'Description', sortable: true },
    { field: 'gageType', header: 'Type', sortable: true, width: '110px' },
    { field: 'status', header: 'Status', sortable: true, filterable: true, type: 'enum', width: '130px',
      filterOptions: [
        { value: 'InService', label: 'In Service' },
        { value: 'DueForCalibration', label: 'Due for Cal' },
        { value: 'OutForCalibration', label: 'Out for Cal' },
        { value: 'OutOfService', label: 'Out of Service' },
        { value: 'Retired', label: 'Retired' },
      ] },
    { field: 'nextCalibrationDue', header: 'Next Cal Due', sortable: true, type: 'date', width: '110px' },
    { field: 'calibrationCount', header: 'Cal Records', sortable: true, type: 'number', width: '90px', align: 'center' },
  ];

  protected readonly statusOptions: SelectOption[] = [
    { value: null, label: '-- All --' },
    { value: 'InService', label: 'In Service' },
    { value: 'DueForCalibration', label: 'Due for Calibration' },
    { value: 'OutForCalibration', label: 'Out for Calibration' },
    { value: 'OutOfService', label: 'Out of Service' },
    { value: 'Retired', label: 'Retired' },
  ];

  protected readonly createForm = new FormGroup({
    description: new FormControl('', [Validators.required, Validators.maxLength(500)]),
    gageType: new FormControl(''),
    manufacturer: new FormControl(''),
    model: new FormControl(''),
    serialNumber: new FormControl(''),
    calibrationIntervalDays: new FormControl(365, [Validators.required, Validators.min(1)]),
    accuracySpec: new FormControl(''),
    rangeSpec: new FormControl(''),
    resolution: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly createViolations = FormValidationService.getViolations(this.createForm, {
    description: 'Description',
    calibrationIntervalDays: 'Calibration Interval',
  });

  protected readonly calResultOptions: SelectOption[] = [
    { value: 'Pass', label: 'Pass' },
    { value: 'Fail', label: 'Fail' },
    { value: 'Adjusted', label: 'Adjusted' },
    { value: 'OutOfTolerance', label: 'Out of Tolerance' },
  ];

  protected readonly calForm = new FormGroup({
    calibratedAt: new FormControl<Date | null>(new Date(), [Validators.required]),
    result: new FormControl('Pass', [Validators.required]),
    labName: new FormControl(''),
    standardsUsed: new FormControl(''),
    asFoundCondition: new FormControl(''),
    asLeftCondition: new FormControl(''),
    notes: new FormControl(''),
  });

  protected readonly calViolations = FormValidationService.getViolations(this.calForm, {
    calibratedAt: 'Calibrated Date',
    result: 'Result',
  });

  constructor() {
    this.loadGages();
  }

  loadGages(): void {
    this.loading.set(true);
    const status = this.statusFilter.value ?? undefined;
    const search = this.searchControl.value?.trim() || undefined;
    this.qualityService.getGages(status, search).subscribe({
      next: (gages) => { this.gages.set(gages); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected applyFilters(): void {
    this.loadGages();
  }

  openCreate(): void {
    this.createForm.reset({ description: '', calibrationIntervalDays: 365 });
    this.showCreateDialog.set(true);
  }

  protected closeCreate(): void {
    this.showCreateDialog.set(false);
  }

  protected saveGage(): void {
    if (this.createForm.invalid) return;
    this.saving.set(true);
    const f = this.createForm.getRawValue();
    this.qualityService.createGage({
      description: f.description!,
      gageType: f.gageType || undefined,
      manufacturer: f.manufacturer || undefined,
      model: f.model || undefined,
      serialNumber: f.serialNumber || undefined,
      calibrationIntervalDays: f.calibrationIntervalDays!,
      accuracySpec: f.accuracySpec || undefined,
      rangeSpec: f.rangeSpec || undefined,
      resolution: f.resolution || undefined,
      notes: f.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCreate();
        this.loadGages();
        this.snackbar.success('Gage created');
      },
      error: () => this.saving.set(false),
    });
  }

  protected openDetail(gage: Gage): void {
    this.selectedGage.set(gage);
    this.showDetailDialog.set(true);
    this.loadCalibrations(gage.id);
  }

  protected closeDetail(): void {
    this.showDetailDialog.set(false);
    this.selectedGage.set(null);
    this.calibrations.set([]);
  }

  private loadCalibrations(gageId: number): void {
    this.calibrationLoading.set(true);
    this.qualityService.getGageCalibrations(gageId).subscribe({
      next: (records) => { this.calibrations.set(records); this.calibrationLoading.set(false); },
      error: () => this.calibrationLoading.set(false),
    });
  }

  protected openCalDialog(): void {
    this.calForm.reset({ calibratedAt: new Date(), result: 'Pass' });
    this.showCalDialog.set(true);
  }

  protected closeCalDialog(): void {
    this.showCalDialog.set(false);
  }

  protected saveCalibration(): void {
    if (this.calForm.invalid) return;
    const gage = this.selectedGage();
    if (!gage) return;
    this.calSaving.set(true);
    const f = this.calForm.getRawValue();
    this.qualityService.createCalibrationRecord(gage.id, {
      calibratedAt: toIsoDate(f.calibratedAt!)!,
      result: f.result as 'Pass' | 'Fail' | 'Adjusted' | 'OutOfTolerance',
      labName: f.labName || undefined,
      standardsUsed: f.standardsUsed || undefined,
      asFoundCondition: f.asFoundCondition || undefined,
      asLeftCondition: f.asLeftCondition || undefined,
      notes: f.notes || undefined,
    }).subscribe({
      next: () => {
        this.calSaving.set(false);
        this.closeCalDialog();
        this.loadCalibrations(gage.id);
        this.loadGages();
        this.snackbar.success('Calibration recorded');
      },
      error: () => this.calSaving.set(false),
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      InService: 'chip chip--success',
      DueForCalibration: 'chip chip--warning',
      OutForCalibration: 'chip chip--info',
      OutOfService: 'chip chip--error',
      Retired: 'chip chip--muted',
    };
    return map[status] ?? 'chip';
  }

  protected getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      InService: 'In Service',
      DueForCalibration: 'Due for Cal',
      OutForCalibration: 'Out for Cal',
      OutOfService: 'Out of Service',
      Retired: 'Retired',
    };
    return map[status] ?? status;
  }

  protected getCalResultClass(result: string): string {
    const map: Record<string, string> = {
      Pass: 'chip chip--success',
      Fail: 'chip chip--error',
      Adjusted: 'chip chip--warning',
      OutOfTolerance: 'chip chip--error',
    };
    return map[result] ?? 'chip';
  }
}
