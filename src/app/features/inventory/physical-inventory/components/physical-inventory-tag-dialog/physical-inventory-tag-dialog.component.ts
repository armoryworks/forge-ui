import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PhysicalInventoryService } from '../../services/physical-inventory.service';
import { PhysicalInventoryTag } from '../../models/physical-inventory-tag.model';
import { InventoryService } from '../../../services/inventory.service';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { EntityPickerComponent } from '../../../../../shared/components/entity-picker/entity-picker.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';

@Component({
  selector: 'app-physical-inventory-tag-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, EntityPickerComponent, ValidationButtonComponent],
  templateUrl: './physical-inventory-tag-dialog.component.html',
  styleUrl: './physical-inventory-tag-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhysicalInventoryTagDialogComponent {
  private readonly service = inject(PhysicalInventoryService);
  private readonly inventory = inject(InventoryService);
  private readonly translate = inject(TranslateService);

  readonly inventoryId = input.required<number>();
  readonly closed = output<void>();
  readonly added = output<PhysicalInventoryTag>();

  protected readonly saving = signal(false);
  protected readonly locationOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    locationId: new FormControl<number | null>(null, [Validators.required]),
    partId: new FormControl<number | null>(null, [Validators.required]),
    lotNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    locationId: this.translate.instant('physicalInventory.location'),
    partId: this.translate.instant('common.part'),
    quantity: this.translate.instant('physicalInventory.counted'),
  });

  constructor() {
    this.inventory.getAllActiveBinLocations().subscribe({
      next: locations => this.locationOptions.set(locations.map(l => ({ value: l.id, label: l.locationPath || l.name }))),
      error: () => this.locationOptions.set([]),
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    this.saving.set(true);
    this.service.addTag(this.inventoryId(), {
      locationId: f.locationId!,
      partId: f.partId!,
      lotNumber: f.lotNumber.trim() || null,
      serialNumber: null,
      quantity: f.quantity,
      notes: f.notes.trim() || null,
    }).subscribe({
      next: tag => {
        this.saving.set(false);
        this.added.emit(tag);
      },
      error: () => this.saving.set(false),
    });
  }
}
