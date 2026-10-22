import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InventoryService } from '../../services/inventory.service';
import { UnitOfMeasure, UomCategory } from '../../models/unit-of-measure.model';
import { UomConversion } from '../../models/uom-conversion.model';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-uom-management',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe, DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, ToggleComponent,
    ValidationButtonComponent, LoadingBlockDirective, EmptyStateComponent,
  ],
  templateUrl: './uom-management.component.html',
  styleUrl: './uom-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UomManagementComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);

  protected readonly canManage = this.auth.hasAnyRole(['Admin', 'Manager']);

  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly uoms = signal<UnitOfMeasure[]>([]);
  protected readonly conversions = signal<UomConversion[]>([]);
  protected readonly showUomDialog = signal(false);
  protected readonly showConversionDialog = signal(false);
  protected readonly editingUom = signal<UnitOfMeasure | null>(null);
  protected readonly activeSection = signal<'uoms' | 'conversions'>('uoms');

  protected readonly categoryOptions: SelectOption[] = [
    { value: 'Count', label: this.translate.instant('inventory.uom.categories.count') },
    { value: 'Length', label: this.translate.instant('inventory.uom.categories.length') },
    { value: 'Weight', label: this.translate.instant('inventory.uom.categories.weight') },
    { value: 'Volume', label: this.translate.instant('inventory.uom.categories.volume') },
    { value: 'Area', label: this.translate.instant('inventory.uom.categories.area') },
    { value: 'Time', label: this.translate.instant('inventory.uom.categories.time') },
  ];

  protected readonly uomColumns: ColumnDef[] = [
    { field: 'code', header: this.translate.instant('inventory.uom.code'), sortable: true, width: '80px' },
    { field: 'name', header: this.translate.instant('common.name'), sortable: true },
    { field: 'symbol', header: this.translate.instant('inventory.uom.symbol'), sortable: true, width: '80px' },
    { field: 'category', header: this.translate.instant('common.category'), sortable: true, filterable: true, type: 'enum',
      filterOptions: this.categoryOptions, width: '120px' },
    { field: 'decimalPlaces', header: this.translate.instant('inventory.uom.decimals'), sortable: true, align: 'center', width: '90px' },
    { field: 'isBaseUnit', header: this.translate.instant('inventory.uom.base'), sortable: true, align: 'center', width: '70px' },
    ...(this.canManage ? [{ field: 'actions', header: '', width: '60px' }] : []),
  ];

  protected readonly conversionColumns: ColumnDef[] = [
    { field: 'fromUomCode', header: this.translate.instant('common.from'), sortable: true, width: '100px' },
    { field: 'toUomCode', header: this.translate.instant('common.to'), sortable: true, width: '100px' },
    { field: 'conversionFactor', header: this.translate.instant('inventory.uom.factor'), sortable: true, align: 'right', width: '120px' },
    { field: 'isReversible', header: this.translate.instant('inventory.uom.reversible'), sortable: true, align: 'center', width: '100px' },
  ];

  protected readonly uomForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(10)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    symbol: new FormControl(''),
    category: new FormControl<string>('Count', { nonNullable: true, validators: [Validators.required] }),
    decimalPlaces: new FormControl<number>(2, { nonNullable: true, validators: [Validators.required, Validators.min(0), Validators.max(6)] }),
    isBaseUnit: new FormControl(false, { nonNullable: true }),
    sortOrder: new FormControl<number>(0, { nonNullable: true }),
  });

  protected readonly conversionForm = new FormGroup({
    fromUomId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    toUomId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    conversionFactor: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0.00000001)] }),
    isReversible: new FormControl(true, { nonNullable: true }),
  });

  protected readonly uomViolations = FormValidationService.getViolations(this.uomForm, {
    code: this.translate.instant('inventory.uom.code'), name: this.translate.instant('common.name'),
    category: this.translate.instant('common.category'), decimalPlaces: this.translate.instant('inventory.uom.decimalPlaces'),
  });

  protected readonly conversionViolations = FormValidationService.getViolations(this.conversionForm, {
    fromUomId: this.translate.instant('inventory.uom.fromUom'), toUomId: this.translate.instant('inventory.uom.toUom'),
    conversionFactor: this.translate.instant('inventory.uom.conversionFactor'),
  });

  protected readonly uomSelectOptions = signal<SelectOption[]>([]);

  ngOnInit(): void {
    this.loadUoms();
    this.loadConversions();
  }

  protected switchSection(section: 'uoms' | 'conversions'): void {
    this.activeSection.set(section);
  }

  protected openCreateUom(): void {
    this.editingUom.set(null);
    this.uomForm.reset({ category: 'Count', decimalPlaces: 2, isBaseUnit: false, sortOrder: 0 });
    this.showUomDialog.set(true);
  }

  protected openEditUom(uom: UnitOfMeasure): void {
    if (!this.canManage) return;
    this.editingUom.set(uom);
    this.uomForm.patchValue({
      code: uom.code,
      name: uom.name,
      symbol: uom.symbol ?? '',
      category: uom.category,
      decimalPlaces: uom.decimalPlaces,
      isBaseUnit: uom.isBaseUnit,
      sortOrder: uom.sortOrder,
    });
    this.showUomDialog.set(true);
  }

  protected saveUom(): void {
    if (this.uomForm.invalid) return;
    this.saving.set(true);
    const data = this.uomForm.getRawValue();
    const payload = { ...data, symbol: data.symbol || null, category: data.category as UomCategory, sortOrder: data.sortOrder ?? 0 };
    const editing = this.editingUom();

    const obs = editing
      ? this.inventoryService.updateUnitOfMeasure(editing.id, payload, editing.rowVersion)
      : this.inventoryService.createUnitOfMeasure(payload);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant(editing ? 'inventory.uom.updated' : 'inventory.uom.created'));
        this.showUomDialog.set(false);
        this.saving.set(false);
        this.loadUoms();
      },
      error: () => this.saving.set(false),
    });
  }

  protected openCreateConversion(): void {
    this.conversionForm.reset({ isReversible: true });
    this.showConversionDialog.set(true);
  }

  protected saveConversion(): void {
    if (this.conversionForm.invalid) return;
    this.saving.set(true);
    const data = this.conversionForm.getRawValue();

    this.inventoryService.createUomConversion({
      fromUomId: data.fromUomId!,
      toUomId: data.toUomId!,
      conversionFactor: data.conversionFactor!,
      isReversible: data.isReversible,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('inventory.uom.conversionCreated'));
        this.showConversionDialog.set(false);
        this.saving.set(false);
        this.loadConversions();
      },
      error: () => this.saving.set(false),
    });
  }

  private loadUoms(): void {
    this.loading.set(true);
    this.inventoryService.getUnitsOfMeasure()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (uoms) => {
          this.uoms.set(uoms);
          this.uomSelectOptions.set(uoms.map(u => ({ value: u.id, label: `${u.code} — ${u.name}` })));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  private loadConversions(): void {
    this.inventoryService.getUomConversions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(c => this.conversions.set(c));
  }
}
