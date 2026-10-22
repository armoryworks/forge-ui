import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { debounceTime, distinctUntilChanged } from 'rxjs';

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
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { toIsoDate } from '../../../shared/utils/date.utils';
import { AuthService } from '../../../shared/services/auth.service';
import { QUALITY_MANAGER_ROLES } from '../quality-roles';

const MAX_CALIBRATION_INTERVAL_DAYS = 3650;

@Component({
  selector: 'app-gage-list',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule,
    DataTableComponent, DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    DatepickerComponent, EmptyStateComponent, LoadingBlockDirective, ValidationButtonComponent,
    ColumnCellDirective, TranslatePipe,
  ],
  templateUrl: './gage-list.component.html',
  styleUrl: './gage-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GageListComponent {
  private readonly qualityService = inject(QualityService);
  private readonly snackbar = inject(SnackbarService);
  private readonly auth = inject(AuthService);
  private readonly translate = inject(TranslateService);

  protected readonly canManage = computed(() => this.auth.hasAnyRole(QUALITY_MANAGER_ROLES));
  protected readonly today = new Date();
  protected readonly maxIntervalDays = MAX_CALIBRATION_INTERVAL_DAYS;
  protected readonly editingGageId = signal<number | null>(null);

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
    { field: 'gageNumber', header: 'columns.gageNumber', sortable: true, width: '110px' },
    { field: 'description', header: 'common.description', sortable: true },
    { field: 'gageType', header: 'common.type', sortable: true, width: '110px' },
    { field: 'status', header: 'common.status', sortable: true, filterable: true, type: 'enum', width: '130px',
      filterOptions: [
        { value: 'InService', label: 'In Service' },
        { value: 'DueForCalibration', label: 'Due for Cal' },
        { value: 'OutForCalibration', label: 'Out for Cal' },
        { value: 'OutOfService', label: 'Out of Service' },
        { value: 'Retired', label: 'Retired' },
      ] },
    { field: 'nextCalibrationDue', header: 'columns.nextCalibrationDue', sortable: true, type: 'date', width: '110px' },
    { field: 'calibrationCount', header: 'columns.calibrationRecords', sortable: true, type: 'number', width: '90px', align: 'center' },
  ];

  protected readonly calibrationColumns: ColumnDef[] = [
    { field: 'calibratedAt', header: 'common.date', sortable: true, type: 'date', width: '110px' },
    { field: 'result', header: 'columns.result', sortable: true, width: '120px' },
    { field: 'labName', header: 'columns.lab', sortable: true },
    { field: 'standardsUsed', header: 'columns.standards', sortable: true },
    { field: 'asFoundCondition', header: 'columns.asFound', sortable: true },
    { field: 'asLeftCondition', header: 'columns.asLeft', sortable: true },
    { field: 'nextCalibrationDue', header: 'columns.nextDue', sortable: true, type: 'date', width: '110px' },
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
    calibrationIntervalDays: new FormControl(365, [Validators.required, Validators.min(1), Validators.max(MAX_CALIBRATION_INTERVAL_DAYS)]),
    lastCalibratedAt: new FormControl<Date | null>(null),
    status: new FormControl<GageStatus | null>(null),
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
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.loadGages());
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
    this.editingGageId.set(null);
    this.createForm.reset({ description: '', calibrationIntervalDays: 365, lastCalibratedAt: null, status: null });
    this.showCreateDialog.set(true);
  }

  protected openEdit(gage: Gage): void {
    this.editingGageId.set(gage.id);
    this.createForm.reset({
      description: gage.description,
      gageType: gage.gageType ?? '',
      manufacturer: gage.manufacturer ?? '',
      model: gage.model ?? '',
      serialNumber: gage.serialNumber ?? '',
      calibrationIntervalDays: gage.calibrationIntervalDays,
      lastCalibratedAt: null,
      status: gage.status,
      accuracySpec: gage.accuracySpec ?? '',
      rangeSpec: gage.rangeSpec ?? '',
      resolution: gage.resolution ?? '',
      notes: gage.notes ?? '',
    });
    this.showCreateDialog.set(true);
  }

  protected closeCreate(): void {
    this.showCreateDialog.set(false);
  }

  protected saveGage(): void {
    if (this.createForm.invalid) return;
    this.saving.set(true);
    const f = this.createForm.getRawValue();
    const editingId = this.editingGageId();
    if (editingId != null) {
      this.qualityService.updateGage(editingId, {
        description: f.description!,
        gageType: f.gageType ?? '',
        manufacturer: f.manufacturer ?? '',
        model: f.model ?? '',
        serialNumber: f.serialNumber ?? '',
        calibrationIntervalDays: f.calibrationIntervalDays!,
        status: f.status ?? undefined,
        accuracySpec: f.accuracySpec ?? '',
        rangeSpec: f.rangeSpec ?? '',
        resolution: f.resolution ?? '',
        notes: f.notes ?? '',
      }).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.closeCreate();
          if (this.selectedGage()?.id === updated.id) this.selectedGage.set(updated);
          this.loadGages();
          this.snackbar.success(this.translate.instant('gages.updated'));
        },
        error: () => this.saving.set(false),
      });
      return;
    }
    this.qualityService.createGage({
      description: f.description!,
      gageType: f.gageType || undefined,
      manufacturer: f.manufacturer || undefined,
      model: f.model || undefined,
      serialNumber: f.serialNumber || undefined,
      calibrationIntervalDays: f.calibrationIntervalDays!,
      lastCalibratedAt: f.lastCalibratedAt ? toIsoDate(f.lastCalibratedAt)! : undefined,
      accuracySpec: f.accuracySpec || undefined,
      rangeSpec: f.rangeSpec || undefined,
      resolution: f.resolution || undefined,
      notes: f.notes || undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeCreate();
        this.loadGages();
        this.snackbar.success(this.translate.instant('quality.messages.gageCreated'));
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
        this.refreshSelectedGage(gage.id);
        this.loadGages();
        this.snackbar.success(this.translate.instant('quality.messages.calibrationRecorded'));
      },
      error: () => this.calSaving.set(false),
    });
  }

  private refreshSelectedGage(gageId: number): void {
    this.qualityService.getGageById(gageId).subscribe({
      next: (fresh) => {
        if (this.selectedGage()?.id === fresh.id) this.selectedGage.set(fresh);
      },
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
