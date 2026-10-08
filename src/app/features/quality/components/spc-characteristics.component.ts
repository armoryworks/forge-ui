import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { SpcService } from '../services/spc.service';
import { SpcCharacteristic } from '../models/spc.model';
import { PartsService } from '../../parts/services/parts.service';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../shared/models/column-def.model';
import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-spc-characteristics',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, TranslatePipe,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, EntityPickerComponent, InputComponent, SelectComponent,
    TextareaComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective,
  ],
  templateUrl: './spc-characteristics.component.html',
  styleUrl: './spc-characteristics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpcCharacteristicsComponent {
  private readonly spcService = inject(SpcService);
  private readonly snackbar = inject(SnackbarService);
  private readonly partsService = inject(PartsService);
  private readonly translate = inject(TranslateService);

  readonly characteristicSelected = output<SpcCharacteristic>();

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly characteristics = signal<SpcCharacteristic[]>([]);
  protected readonly showDialog = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly operationOptions = signal<SelectOption[]>([]);
  protected readonly editingPartNumber = signal('');
  private operationsSub: Subscription | null = null;

  protected readonly columns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('spc.characteristics.colPartNumber'), sortable: true, width: '120px' },
    { field: 'name', header: this.translate.instant('spc.characteristics.colCharacteristic'), sortable: true },
    { field: 'operationName', header: this.translate.instant('spc.characteristics.operation'), sortable: true, width: '140px' },
    { field: 'nominalValue', header: this.translate.instant('spc.characteristics.colNominal'), sortable: true, width: '90px', align: 'right' },
    { field: 'specLimits', header: this.translate.instant('spc.characteristics.colSpecLimits'), width: '140px', align: 'center' },
    { field: 'sampleSize', header: this.translate.instant('spc.characteristics.colSampleSize'), sortable: true, width: '50px', align: 'center' },
    { field: 'measurementCount', header: this.translate.instant('spc.characteristics.colMeasurements'), sortable: true, width: '110px', align: 'right' },
    { field: 'latestCpk', header: this.translate.instant('spc.characteristics.colCpk'), sortable: true, width: '80px', align: 'right' },
    { field: 'isActive', header: this.translate.instant('common.active'), sortable: true, width: '70px', align: 'center' },
    { field: 'actions', header: '', width: '50px', align: 'center' },
  ];

  protected readonly measurementTypeOptions: SelectOption[] = [
    { value: 'Variable', label: this.translate.instant('spc.characteristics.measurementTypes.Variable') },
    { value: 'Attribute', label: this.translate.instant('spc.characteristics.measurementTypes.Attribute') },
  ];

  protected readonly form = new FormGroup({
    partId: new FormControl<number | null>(null, [Validators.required]),
    operationId: new FormControl<number | null>(null),
    name: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    description: new FormControl(''),
    measurementType: new FormControl('Variable'),
    nominalValue: new FormControl<number>(0, [Validators.required]),
    upperSpecLimit: new FormControl<number>(0, [Validators.required]),
    lowerSpecLimit: new FormControl<number>(0, [Validators.required]),
    unitOfMeasure: new FormControl(''),
    decimalPlaces: new FormControl<number>(4, [Validators.required, Validators.min(0), Validators.max(6)]),
    sampleSize: new FormControl<number>(5, [Validators.required, Validators.min(2), Validators.max(25)]),
    sampleFrequency: new FormControl(''),
    gageId: new FormControl<number | null>(null),
    notifyOnOoc: new FormControl(true),
    isActive: new FormControl(true),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    partId: this.translate.instant('spc.characteristics.part'),
    name: this.translate.instant('common.name'),
    nominalValue: this.translate.instant('spc.characteristics.nominalValue'),
    upperSpecLimit: this.translate.instant('spc.characteristics.upperSpecLimit'),
    lowerSpecLimit: this.translate.instant('spc.characteristics.lowerSpecLimit'),
    decimalPlaces: this.translate.instant('spc.characteristics.decimalPlaces'),
    sampleSize: this.translate.instant('spc.characteristics.sampleSize'),
  });

  constructor() {
    this.loadCharacteristics();
    this.form.controls.partId.valueChanges.pipe(takeUntilDestroyed()).subscribe(partId => {
      this.form.controls.operationId.setValue(null);
      this.loadOperations(partId);
    });
  }

  loadCharacteristics(): void {
    this.loading.set(true);
    this.spcService.getCharacteristics({ isActive: true }).subscribe({
      next: data => { this.characteristics.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingId.set(null);
    this.editingPartNumber.set('');
    this.form.reset({ measurementType: 'Variable', decimalPlaces: 4, sampleSize: 5, notifyOnOoc: true, isActive: true });
    this.showDialog.set(true);
  }

  protected openEdit(char: SpcCharacteristic): void {
    this.editingId.set(char.id);
    this.editingPartNumber.set(char.partNumber);
    this.form.patchValue({
      partId: char.partId,
      operationId: char.operationId,
      name: char.name,
      description: char.description,
      measurementType: char.measurementType,
      nominalValue: char.nominalValue,
      upperSpecLimit: char.upperSpecLimit,
      lowerSpecLimit: char.lowerSpecLimit,
      unitOfMeasure: char.unitOfMeasure,
      decimalPlaces: char.decimalPlaces,
      sampleSize: char.sampleSize,
      sampleFrequency: char.sampleFrequency,
      gageId: char.gageId,
      notifyOnOoc: char.notifyOnOoc,
      isActive: char.isActive,
    }, { emitEvent: false });
    this.loadOperations(char.partId);
    this.form.updateValueAndValidity();
    this.showDialog.set(true);
  }

  protected closeDialog(): void {
    this.showDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const data = this.form.getRawValue();

    const request = {
      partId: data.partId!,
      operationId: data.operationId ?? undefined,
      name: data.name!,
      description: data.description || undefined,
      measurementType: data.measurementType as 'Variable' | 'Attribute',
      nominalValue: data.nominalValue!,
      upperSpecLimit: data.upperSpecLimit!,
      lowerSpecLimit: data.lowerSpecLimit!,
      unitOfMeasure: data.unitOfMeasure || undefined,
      decimalPlaces: data.decimalPlaces!,
      sampleSize: data.sampleSize!,
      sampleFrequency: data.sampleFrequency || undefined,
      gageId: data.gageId ?? undefined,
      notifyOnOoc: data.notifyOnOoc!,
      isActive: data.isActive!,
    };

    const obs = this.editingId()
      ? this.spcService.updateCharacteristic(this.editingId()!, request)
      : this.spcService.createCharacteristic(request);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeDialog();
        this.loadCharacteristics();
        this.snackbar.success(this.translate.instant(
          this.editingId() ? 'spc.characteristics.updated' : 'spc.characteristics.created'));
      },
      error: () => this.saving.set(false),
    });
  }

  private loadOperations(partId: number | null): void {
    this.operationsSub?.unsubscribe();
    this.operationOptions.set([]);
    if (partId == null) return;
    this.operationsSub = this.partsService.getOperations(partId).subscribe({
      next: operations => this.operationOptions.set(operations.length === 0 ? [] : [
        { value: null, label: this.translate.instant('spc.characteristics.noOperation') },
        ...[...operations]
          .sort((a, b) => a.stepNumber - b.stepNumber)
          .map(op => ({ value: op.id, label: `${op.stepNumber} · ${op.title}` })),
      ]),
    });
  }

  protected selectCharacteristic(char: SpcCharacteristic): void {
    this.characteristicSelected.emit(char);
  }

  protected getCpkClass(cpk: number | null): string {
    if (cpk == null) return '';
    if (cpk >= 1.33) return 'spc-cpk--good';
    if (cpk >= 1.0) return 'spc-cpk--warning';
    return 'spc-cpk--danger';
  }
}
