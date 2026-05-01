import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { LotSizingRule } from '../../../models/lot-sizing-rule.type';
import { PartDetail } from '../../../models/part-detail.model';

/**
 * Pillar 4 Phase 2 — MRP Planning cluster.
 *
 * Surfaces IsMrpPlanned, LotSizingRule, lot-size parameters (FixedQty,
 * MinQty, OrderMultiple), and planning/demand fences. Lead-time is read-
 * only here because the reader migration prefers VendorPart's lead-time
 * snapshot over the part-level one when a preferred vendor part exists.
 */
@Component({
  selector: 'app-part-mrp-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-mrp-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartMrpClusterComponent {
  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  protected readonly lotSizingOptions: SelectOption[] = [
    { value: null, label: '-- Unset --' },
    { value: 'LotForLot', label: 'Lot-for-Lot' },
    { value: 'FixedQuantity', label: 'Fixed Quantity' },
    { value: 'MinMax', label: 'Min/Max' },
    { value: 'EconomicOrderQuantity', label: 'EOQ (Economic Order Qty)' },
    { value: 'MultiplesOf', label: 'Multiples Of' },
  ];

  protected readonly form = new FormGroup({
    isMrpPlanned: new FormControl<boolean>(false, { nonNullable: true }),
    lotSizingRule: new FormControl<LotSizingRule | null>(null),
    fixedOrderQuantity: new FormControl<number | null>(null, [Validators.min(0)]),
    minimumOrderQuantity: new FormControl<number | null>(null, [Validators.min(0)]),
    orderMultiple: new FormControl<number | null>(null, [Validators.min(0)]),
    planningFenceDays: new FormControl<number | null>(null, [Validators.min(0)]),
    demandFenceDays: new FormControl<number | null>(null, [Validators.min(0)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {});

  // Track form values reactively so conditional reveal works without
  // function calls in the template.
  private readonly lotRuleSignal = signal<LotSizingRule | null>(null);
  private readonly minQtySignal = signal<number | null>(null);

  protected readonly showFixedQty = computed(() => this.lotRuleSignal() === 'FixedQuantity');
  protected readonly showOrderMultiple = computed(() => this.minQtySignal() !== null);

  constructor() {
    this.form.controls.lotSizingRule.valueChanges.subscribe(v => this.lotRuleSignal.set(v));
    this.form.controls.minimumOrderQuantity.valueChanges.subscribe(v => this.minQtySignal.set(v));

    effect(() => {
      const p = this.part();
      this.form.reset({
        isMrpPlanned: p.isMrpPlanned ?? false,
        lotSizingRule: p.lotSizingRule ?? null,
        fixedOrderQuantity: p.fixedOrderQuantity ?? null,
        minimumOrderQuantity: p.minimumOrderQuantity ?? null,
        orderMultiple: p.orderMultiple ?? null,
        planningFenceDays: p.planningFenceDays ?? null,
        demandFenceDays: p.demandFenceDays ?? null,
      });
      this.lotRuleSignal.set(p.lotSizingRule ?? null);
      this.minQtySignal.set(p.minimumOrderQuantity ?? null);
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
      isMrpPlanned: v.isMrpPlanned,
      lotSizingRule: v.lotSizingRule ?? null,
      fixedOrderQuantity: v.fixedOrderQuantity ?? null,
      minimumOrderQuantity: v.minimumOrderQuantity ?? null,
      orderMultiple: v.orderMultiple ?? null,
      planningFenceDays: v.planningFenceDays ?? null,
      demandFenceDays: v.demandFenceDays ?? null,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
