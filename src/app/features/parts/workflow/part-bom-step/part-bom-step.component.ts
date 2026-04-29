import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';

import { ColumnDef } from '../../../../shared/models/column-def.model';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { BOMEntry } from '../../models/bom-entry.model';
import { BOMSourceType } from '../../models/bom-source-type.type';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/**
 * Workflow Pattern Phase 5 — BOM step. Wraps the same BOM table + add-dialog
 * pattern used by `PartDetailPanelComponent`, scoped to a single step view.
 * Sync with the workflow service after each mutation so the step rail's
 * `hasBom` gate reflects current state.
 */
@Component({
  selector: 'app-part-bom-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DataTableComponent, ColumnCellDirective,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, EntityPickerComponent,
    EmptyStateComponent, LoadingBlockDirective, ValidationButtonComponent,
  ],
  templateUrl: './part-bom-step.component.html',
  styleUrl: './part-bom-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartBomStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly stepId = input<string>('bom');
  readonly componentName = input<string>('PartBomStepComponent');
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly bomEntries = signal<BOMEntry[]>([]);
  protected readonly saving = signal(false);
  protected readonly showAddDialog = signal(false);

  protected readonly part = computed<PartDetail | null>(() => (this.entity() as PartDetail | null) ?? null);

  protected readonly bomColumns: ColumnDef[] = [
    { field: 'sortOrder', header: '#', width: '40px', align: 'center' },
    { field: 'childPartNumber', header: this.translate.instant('parts.bomPart'), sortable: true },
    { field: 'quantity', header: this.translate.instant('parts.bomQty'), width: '70px', align: 'center', sortable: true },
    { field: 'sourceType', header: this.translate.instant('parts.bomSource'), width: '90px', sortable: true },
    { field: 'leadTimeDays', header: this.translate.instant('parts.bomLeadTime'), width: '100px' },
    { field: 'referenceDesignator', header: this.translate.instant('parts.bomRefDes') },
    { field: 'actions', header: '', width: '40px' },
  ];

  protected readonly form = new FormGroup({
    childPartId: new FormControl<number | null>(null, { validators: [Validators.required] }),
    quantity: new FormControl(1, { nonNullable: true, validators: [Validators.required, Validators.min(0.01)] }),
    sourceType: new FormControl<BOMSourceType>('Buy', { nonNullable: true }),
    referenceDesignator: new FormControl(''),
    leadTimeDays: new FormControl<number | null>(null),
    notes: new FormControl(''),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    childPartId: 'Child Part',
    quantity: 'Quantity',
  });

  protected readonly sourceTypeOptions: SelectOption[] = [
    { value: 'Make', label: this.translate.instant('parts.sourceMake') },
    { value: 'Buy', label: this.translate.instant('parts.sourceBuy') },
    { value: 'Stock', label: this.translate.instant('parts.sourceStock') },
  ];

  constructor() {
    // Hydrate the BOM list from the loaded entity, refreshing when the
    // upstream entity changes (e.g., another step modified the part).
    effect(() => {
      const part = this.part();
      this.bomEntries.set(part?.bomEntries ?? []);
    });
  }

  protected openAdd(): void {
    this.form.reset({
      childPartId: null,
      quantity: 1,
      sourceType: 'Buy',
      referenceDesignator: '',
      leadTimeDays: null,
      notes: '',
    });
    this.showAddDialog.set(true);
  }

  protected closeAdd(): void {
    this.showAddDialog.set(false);
  }

  protected save(): void {
    if (this.form.invalid) return;
    const id = this.entityId();
    if (id == null) return;
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.partsService.createBOMEntry(id, {
      childPartId: v.childPartId!,
      quantity: v.quantity,
      sourceType: v.sourceType,
      referenceDesignator: v.referenceDesignator || undefined,
      leadTimeDays: v.leadTimeDays ?? undefined,
      notes: v.notes || undefined,
    }).subscribe({
      next: (detail) => {
        this.saving.set(false);
        this.bomEntries.set(detail.bomEntries ?? []);
        this.workflowService.currentEntity.set(detail);
        this.showAddDialog.set(false);
        this.snackbar.success(this.translate.instant('parts.bomEntryAdded'));
      },
      error: () => {
        this.saving.set(false);
        this.snackbar.error(this.translate.instant('parts.workflow.bom.saveFailed'));
      },
    });
  }

  protected deleteEntry(entry: BOMEntry): void {
    const id = this.entityId();
    if (id == null) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('parts.deleteBomEntry'),
        message: this.translate.instant('parts.deleteBomMessage'),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe((confirmed) => {
      if (!confirmed) return;
      this.saving.set(true);
      this.partsService.deleteBOMEntry(id, entry.id).subscribe({
        next: (detail) => {
          this.saving.set(false);
          this.bomEntries.set(detail.bomEntries ?? []);
          this.workflowService.currentEntity.set(detail);
          this.snackbar.success(this.translate.instant('parts.bomEntryDeleted'));
        },
        error: () => this.saving.set(false),
      });
    });
  }
}
