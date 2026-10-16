import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InventoryService } from '../../../../inventory/services/inventory.service';
import { shallowEqual } from '../../../../../shared/utils/shallow-equal';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { PartDetail } from '../../../models/part-detail.model';

/**
 * Pillar 4 Phase 2 — Units of Measure cluster.
 *
 * Picks Stock UoM (inventory unit), Purchase UoM (vendor invoice unit),
 * and Sales UoM (customer invoice unit). Falls back to a small fixed list
 * if the UoM endpoint returns an empty result so the cluster never
 * presents an empty dropdown.
 */
@Component({
  selector: 'app-part-uom-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-uom-cluster.component.html',
  styleUrl: '../part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartUomClusterComponent implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly translate = inject(TranslateService);

  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  protected readonly uomOptions = signal<SelectOption[]>([this.noneOption()]);
  protected readonly uomLabelById = signal<Map<number, string>>(new Map());

  protected readonly form = new FormGroup({
    stockUomId: new FormControl<number | null>(null),
    purchaseUomId: new FormControl<number | null>(null),
    salesUomId: new FormControl<number | null>(null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {});

  ngOnInit(): void {
    this.inventoryService.getUnitsOfMeasure().subscribe({
      next: (uoms) => {
        const list = (uoms ?? []).filter(u => u.isActive);
        if (list.length === 0) {
          // Fallback to a small fixed list when the admin tool hasn't populated UoMs yet.
          const fallback: SelectOption[] = [this.noneOption()];
          ['ea', 'kg', 'g', 'lb', 'oz', 'm', 'mm', 'L', 'mL'].forEach((code, idx) => {
            // Negative ids signal "fallback"; the server won't accept them on save
            // but they let the dropdown render before admin populates real UoMs.
            fallback.push({ value: -(idx + 1), label: code });
          });
          this.uomOptions.set(fallback);
          return;
        }
        const options: SelectOption[] = [this.noneOption()];
        const labelMap = new Map<number, string>();
        for (const u of list) {
          const label = u.symbol ? `${u.name} (${u.symbol})` : u.name;
          options.push({ value: u.id, label });
          labelMap.set(u.id, label);
        }
        this.uomOptions.set(options);
        this.uomLabelById.set(labelMap);
      },
    });
  }

  private readonly savedValues = computed(() => {
    const p = this.part();
    return {
      id: p.id,
      stockUomId: p.stockUomId ?? null,
      purchaseUomId: p.purchaseUomId ?? null,
      salesUomId: p.salesUomId ?? null,
    };
  }, { equal: shallowEqual });

  constructor() {
    effect(() => {
      const { stockUomId, purchaseUomId, salesUomId } = this.savedValues();
      this.form.reset({ stockUomId, purchaseUomId, salesUomId });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  private noneOption(): SelectOption {
    return { value: null, label: this.translate.instant('common.none') };
  }

  protected resolveLabel(id: number | null | undefined): string {
    if (id === null || id === undefined) return '---';
    return this.uomLabelById().get(id) ?? `#${id}`;
  }

  protected onSave(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.save.emit({
      stockUomId: v.stockUomId ?? null,
      purchaseUomId: v.purchaseUomId ?? null,
      salesUomId: v.salesUomId ?? null,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
