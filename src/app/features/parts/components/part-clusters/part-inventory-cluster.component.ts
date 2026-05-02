import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { PartDetail } from '../../models/part-detail.model';
import { TraceabilityType } from '../../models/traceability-type.type';
import { AbcClass } from '../../models/abc-class.type';

/**
 * Pillar 4 — Inventory cluster.
 *
 * Renders stock thresholds, traceability and ABC class. Reused by every
 * inventory-stocked combo (B1–B6, M1–M3, S1–S2). Hidden by the layout
 * resolver for Make+Tool (M4) and the Phantom combos (P1, P3).
 */
@Component({
  selector: 'app-part-inventory-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-inventory-cluster.component.html',
  styleUrl: './part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartInventoryClusterComponent {
  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup({
    minStockThreshold: new FormControl<number | null>(null, [Validators.min(0)]),
    reorderPoint: new FormControl<number | null>(null, [Validators.min(0)]),
    reorderQuantity: new FormControl<number | null>(null, [Validators.min(0)]),
    safetyStockDays: new FormControl<number | null>(null, [Validators.min(0)]),
    traceabilityType: new FormControl<TraceabilityType>('None', { nonNullable: true }),
    abcClass: new FormControl<AbcClass | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {});

  protected readonly traceabilityOptions: SelectOption[] = [
    { value: 'None', label: 'None' },
    { value: 'Lot', label: 'Lot' },
    { value: 'Serial', label: 'Serial' },
  ];

  protected readonly abcOptions: SelectOption[] = [
    { value: null, label: '-- Unset --' },
    { value: 'A', label: 'A' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
  ];

  constructor() {
    effect(() => {
      const p = this.part();
      this.form.reset({
        minStockThreshold: p.minStockThreshold,
        reorderPoint: p.reorderPoint,
        reorderQuantity: p.reorderQuantity,
        safetyStockDays: p.safetyStockDays,
        traceabilityType: p.traceabilityType,
        abcClass: p.abcClass,
      });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected onSave(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.save.emit({
      minStockThreshold: v.minStockThreshold ?? null,
      reorderPoint: v.reorderPoint ?? null,
      reorderQuantity: v.reorderQuantity ?? null,
      safetyStockDays: v.safetyStockDays ?? null,
      traceabilityType: v.traceabilityType,
      abcClass: v.abcClass ?? null,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
