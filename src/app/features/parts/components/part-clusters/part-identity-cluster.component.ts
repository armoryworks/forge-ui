import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { PartDetail } from '../../models/part-detail.model';
import { PartStatus } from '../../models/part-status.type';

/**
 * Pillar 4 — Identity & classification cluster.
 *
 * Renders read-only or edit form for the part's identity fields:
 * Part Number (read-only), Name, Description, Revision, Status,
 * ProcurementSource (read-only), InventoryClass (read-only),
 * ItemKindLabel, Manufacturer fields, ExternalPartNumber.
 *
 * Used as the default Identity tab on the Part detail page across
 * every (procurementSource, inventoryClass) combination.
 */
@Component({
  selector: 'app-part-identity-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, SelectComponent, TextareaComponent, ValidationButtonComponent,
  ],
  templateUrl: './part-identity-cluster.component.html',
  styleUrl: './part-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PartIdentityClusterComponent {
  readonly part = input.required<PartDetail>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<PartDetail>>();
  readonly saveAndClose = output<Partial<PartDetail>>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    description: new FormControl<string | null>(null),
    revision: new FormControl('', { nonNullable: true }),
    status: new FormControl<PartStatus>('Draft', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name', status: 'Status',
  });

  protected readonly statusOptions: SelectOption[] = [
    { value: 'Draft', label: 'Draft' },
    { value: 'Prototype', label: 'Prototype' },
    { value: 'Active', label: 'Active' },
    { value: 'Obsolete', label: 'Obsolete' },
  ];

  protected readonly procurementLabel = computed(() => this.part().procurementSource);
  protected readonly inventoryClassLabel = computed(() => this.part().inventoryClass);

  constructor() {
    effect(() => {
      const p = this.part();
      this.form.reset({
        name: p.name,
        description: p.description,
        revision: p.revision,
        status: p.status,
      });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected onSave(close = false): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    (close ? this.saveAndClose : this.save).emit({
      name: v.name,
      description: v.description ?? null,
      revision: v.revision,
      status: v.status,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
