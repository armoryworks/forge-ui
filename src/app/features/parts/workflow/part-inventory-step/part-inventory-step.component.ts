import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable, of, switchMap, tap } from 'rxjs';

import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { WorkflowService } from '../../../../shared/services/workflow.service';
import { InventoryService } from '../../../inventory/services/inventory.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartsService } from '../../services/parts.service';

/**
 * Pillar 6 follow-up — Inventory step. Captures stock thresholds (min /
 * reorder point / reorder qty / safety stock days), the stock UoM, and the
 * default bin id. Used by every non-Phantom combo.
 *
 * Save model: explicit save-on-Continue (registered with WorkflowService).
 */
@Component({
  selector: 'app-part-inventory-step',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    EntityPickerComponent, InputComponent, SelectComponent, LoadingBlockDirective,
  ],
  templateUrl: './part-inventory-step.component.html',
  styleUrl: './part-inventory-step.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartInventoryStepComponent {
  private readonly partsService = inject(PartsService);
  private readonly workflowService = inject(WorkflowService);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly stepId = input<string>('inventory');
  readonly componentName = input<string>('PartInventoryStepComponent');
  readonly runId = input<number | null>(null);
  readonly entityId = input<number | null>(null);
  readonly entity = input<unknown>(null);

  protected readonly saving = signal(false);

  // Stock UoM options come from the DB (GET /inventory/uom) — never a
  // hard-coded list (CLAUDE.md). The form value is the UoM id (FK), which the
  // parts adapter persists directly to Part.StockUomId. New parts are seeded
  // with the base 'each' unit server-side, so this is normally pre-selected.
  private readonly uoms = signal<{ id: number; code: string; name: string }[]>([]);
  protected readonly stockUomOptions = computed<SelectOption[]>(() => [
    { value: null, label: this.translate.instant('parts.workflow.inventory.stockUomNone') },
    ...this.uoms().map(u => ({ value: u.id, label: `${u.name} (${u.code})` })),
  ]);

  protected readonly form = new FormGroup({
    minStockThreshold: new FormControl<number | null>(null, [Validators.min(0)]),
    reorderPoint: new FormControl<number | null>(null, [Validators.min(0)]),
    reorderQuantity: new FormControl<number | null>(null, [Validators.min(0)]),
    safetyStockDays: new FormControl<number | null>(null, [Validators.min(0)]),
    stockUomId: new FormControl<number | null>(null),
    defaultBinId: new FormControl<number | null>(null),
  });

  constructor() {
    this.inventoryService.getUnitsOfMeasure().pipe(
      tap(list => this.uoms.set(list.map(u => ({ id: u.id, code: u.code, name: u.name })))),
    ).subscribe({ error: () => { /* dropdown stays "None"-only; non-fatal */ } });

    effect(() => {
      const part = this.entity() as PartDetail | null;
      if (!part) return;
      this.form.patchValue({
        minStockThreshold: part.minStockThreshold ?? null,
        reorderPoint: part.reorderPoint ?? null,
        reorderQuantity: part.reorderQuantity ?? null,
        safetyStockDays: part.safetyStockDays ?? null,
        stockUomId: part.stockUomId ?? null,
        defaultBinId: part.defaultBinId ?? null,
      }, { emitEvent: false });
    });

    this.workflowService.registerStepForm(
      this.form,
      {
        minStockThreshold: this.translate.instant('parts.workflow.inventory.minStockThresholdLabel'),
        reorderPoint: this.translate.instant('parts.workflow.inventory.reorderPointLabel'),
        reorderQuantity: this.translate.instant('parts.workflow.inventory.reorderQuantityLabel'),
        safetyStockDays: this.translate.instant('parts.workflow.inventory.safetyStockDaysLabel'),
        stockUomId: this.translate.instant('parts.workflow.inventory.stockUomLabel'),
        defaultBinId: this.translate.instant('parts.workflow.inventory.defaultBinLabel'),
      },
      () => this.save(),
    );
    this.destroyRef.onDestroy(() => this.workflowService.unregisterStepForm());
  }

  private save(): Observable<unknown> {
    const runId = this.runId();
    if (runId == null) return of(null);
    if (this.form.pristine) return of(null);
    const value = this.form.getRawValue();
    this.saving.set(true);
    return this.workflowService.patchStep(runId, this.stepId(), {
      minStockThreshold: value.minStockThreshold ?? null,
      reorderPoint: value.reorderPoint ?? null,
      reorderQuantity: value.reorderQuantity ?? null,
      safetyStockDays: value.safetyStockDays ?? null,
      stockUomId: value.stockUomId ?? null,
      defaultBinId: value.defaultBinId ?? null,
    }).pipe(
      switchMap((run) => {
        if (run.entityId == null) return of(null);
        return this.partsService.getPartById(run.entityId).pipe(
          tap((detail) => this.workflowService.currentEntity.set(detail)),
        );
      }),
      tap({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
        },
        error: () => {
          this.saving.set(false);
          this.snackbar.error(this.translate.instant('parts.workflow.inventory.saveFailed'));
        },
      }),
    );
  }
}
