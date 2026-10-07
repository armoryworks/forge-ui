import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { startWith } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { AuthService } from '../../../../shared/services/auth.service';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { InventoryService } from '../../services/inventory.service';
import { PendingInspectionItem } from '../../models/pending-inspection.model';
import { InspectionResult } from '../../models/inspection-result.type';

@Component({
  selector: 'app-receiving-inspection-queue',
  standalone: true,
  imports: [
    DatePipe, ReactiveFormsModule, MatTooltipModule, TranslatePipe, DataTableComponent, ColumnCellDirective,
    EmptyStateComponent, LoadingBlockDirective, DialogComponent, InputComponent, SelectComponent,
    TextareaComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './receiving-inspection-queue.component.html',
  styleUrl: './receiving-inspection-queue.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceivingInspectionQueueComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly items = signal<PendingInspectionItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly inspecting = signal<PendingInspectionItem | null>(null);
  protected readonly waiving = signal<PendingInspectionItem | null>(null);
  protected readonly canWaive = computed(() => this.authService.hasAnyRole(['Admin', 'Manager']));

  protected readonly columns: ColumnDef[] = [
    { field: 'partNumber', header: this.translate.instant('inventory.columns.partNumber'), sortable: true, width: '120px' },
    { field: 'partDescription', header: this.translate.instant('common.description'), sortable: true },
    { field: 'poNumber', header: this.translate.instant('inventory.columns.poNumber'), sortable: true, width: '100px' },
    { field: 'vendorName', header: this.translate.instant('inventory.receivingInspection.columns.vendor'), sortable: true },
    { field: 'receivedQuantity', header: this.translate.instant('inventory.columns.qty'), sortable: true, width: '80px', align: 'right' },
    { field: 'receivedAt', header: this.translate.instant('inventory.receivingInspection.columns.received'), sortable: true, type: 'date', width: '110px' },
    { field: 'daysWaiting', header: this.translate.instant('inventory.receivingInspection.columns.days'), sortable: true, width: '70px', align: 'right' },
    { field: 'actions', header: '', width: '100px' },
  ];

  protected readonly resultOptions: SelectOption[] = [
    { value: 'Passed', label: this.translate.instant('inventory.receivingInspection.results.passed') },
    { value: 'Failed', label: this.translate.instant('inventory.receivingInspection.results.failed') },
    { value: 'PartialAccept', label: this.translate.instant('inventory.receivingInspection.results.partialAccept') },
  ];

  protected readonly inspectForm = new FormGroup({
    result: new FormControl<InspectionResult>('Passed', { nonNullable: true, validators: [Validators.required] }),
    acceptedQuantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    rejectedQuantity: new FormControl<number | null>(0, [Validators.required, Validators.min(0)]),
    notes: new FormControl('', { nonNullable: true }),
    createNcrOnReject: new FormControl(false, { nonNullable: true }),
  }, { validators: control => this.validateQuantities(control) });

  private readonly fieldViolations = FormValidationService.getViolations(this.inspectForm, {
    result: this.translate.instant('inventory.receivingInspection.result'),
    acceptedQuantity: this.translate.instant('inventory.receivingInspection.acceptedQty'),
    rejectedQuantity: this.translate.instant('inventory.receivingInspection.rejectedQty'),
  });
  private readonly quantityViolation = signal<string | null>(null);
  protected readonly inspectViolations = computed(() => {
    const quantity = this.quantityViolation();
    return quantity ? [...this.fieldViolations(), quantity] : this.fieldViolations();
  });

  protected readonly waiveForm = new FormGroup({
    reason: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] }),
  });
  protected readonly waiveViolations = FormValidationService.getViolations(this.waiveForm, {
    reason: this.translate.instant('inventory.receivingInspection.waiveReason'),
  });

  protected readonly rowClass = (row: unknown): string => {
    const item = row as PendingInspectionItem;
    if (item.daysWaiting > 7) return 'row--overdue-critical';
    if (item.daysWaiting > 3) return 'row--overdue-warning';
    return '';
  };

  ngOnInit(): void {
    this.inspectForm.statusChanges.pipe(startWith(this.inspectForm.status), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.quantityViolation.set(this.quantityMessage()));

    this.inspectForm.controls.result.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => this.applyResultDefaults(result));

    this.inspectForm.controls.rejectedQuantity.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(rejected => {
        const ncr = this.inspectForm.controls.createNcrOnReject;
        if (!ncr.dirty) ncr.setValue((rejected ?? 0) > 0);
      });

    this.load();
  }

  protected openInspect(item: PendingInspectionItem): void {
    this.inspecting.set(item);
    this.inspectForm.reset({
      result: 'Passed',
      acceptedQuantity: item.receivedQuantity,
      rejectedQuantity: 0,
      notes: '',
      createNcrOnReject: false,
    }, { emitEvent: false });
    this.inspectForm.updateValueAndValidity();
  }

  protected closeInspect(): void {
    this.inspecting.set(null);
  }

  protected submitInspect(): void {
    const item = this.inspecting();
    if (!item || this.inspectForm.invalid) return;
    const form = this.inspectForm.getRawValue();
    this.saving.set(true);
    this.inventoryService.recordInspectionResult(item.receivingRecordId, {
      result: form.result,
      acceptedQuantity: form.acceptedQuantity ?? 0,
      rejectedQuantity: form.rejectedQuantity ?? 0,
      notes: form.notes.trim() || undefined,
      createNcrOnReject: form.createNcrOnReject,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeInspect();
        this.snackbar.success(this.translate.instant('inventory.receivingInspection.recorded'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  protected openWaive(item: PendingInspectionItem): void {
    this.waiving.set(item);
    this.waiveForm.reset({ reason: '' });
  }

  protected closeWaive(): void {
    this.waiving.set(null);
  }

  protected submitWaive(): void {
    const item = this.waiving();
    if (!item || this.waiveForm.invalid) return;
    this.saving.set(true);
    this.inventoryService.waiveInspection(item.receivingRecordId, this.waiveForm.getRawValue().reason.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeWaive();
        this.snackbar.success(this.translate.instant('inventory.receivingInspection.waived'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  private applyResultDefaults(result: InspectionResult): void {
    const received = this.inspecting()?.receivedQuantity;
    if (received == null) return;
    if (result === 'Passed') this.inspectForm.patchValue({ acceptedQuantity: received, rejectedQuantity: 0 });
    if (result === 'Failed') this.inspectForm.patchValue({ acceptedQuantity: 0, rejectedQuantity: received });
  }

  private validateQuantities(control: AbstractControl): ValidationErrors | null {
    const received = this.inspecting()?.receivedQuantity;
    const accepted = control.get('acceptedQuantity')?.value as number | null;
    const rejected = control.get('rejectedQuantity')?.value as number | null;
    if (received == null || accepted == null || rejected == null) return null;
    const result = control.get('result')?.value as InspectionResult;
    if (result === 'PartialAccept' && (accepted <= 0 || rejected <= 0)) {
      return { partialNeedsBoth: true };
    }
    if (Math.abs(accepted + rejected - received) > 1e-9) return { quantityMismatch: true };
    if (result === 'Passed' && rejected > 0) return { passedWithRejects: true };
    if (result === 'Failed' && accepted > 0) return { failedWithAccepts: true };
    return null;
  }

  private quantityMessage(): string | null {
    const errors = this.inspectForm.errors;
    if (errors?.['partialNeedsBoth']) {
      return this.translate.instant('inventory.receivingInspection.partialNeedsBoth');
    }
    if (errors?.['passedWithRejects']) {
      return this.translate.instant('inventory.receivingInspection.passedWithRejects');
    }
    if (errors?.['failedWithAccepts']) {
      return this.translate.instant('inventory.receivingInspection.failedWithAccepts');
    }
    if (errors?.['quantityMismatch']) {
      return this.translate.instant('inventory.receivingInspection.quantityMismatch', {
        quantity: this.inspecting()?.receivedQuantity,
      });
    }
    return null;
  }

  private load(): void {
    this.loading.set(true);
    this.inventoryService.getPendingInspections().subscribe({
      next: data => { this.items.set(data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
