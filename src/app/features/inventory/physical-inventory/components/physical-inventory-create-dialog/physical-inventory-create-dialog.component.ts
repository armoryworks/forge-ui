import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PhysicalInventoryService } from '../../services/physical-inventory.service';
import { InventoryService } from '../../../services/inventory.service';
import { StorageLocation } from '../../../models/storage-location.model';
import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../../shared/services/snackbar.service';
import { toDateOnly, todayStart } from '../../../../../shared/utils/date.utils';

@Component({
  selector: 'app-physical-inventory-create-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './physical-inventory-create-dialog.component.html',
  styleUrl: './physical-inventory-create-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhysicalInventoryCreateDialogComponent {
  private readonly service = inject(PhysicalInventoryService);
  private readonly inventory = inject(InventoryService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly closed = output<void>();
  readonly created = output<number>();

  protected readonly saving = signal(false);
  protected readonly scopeOptions = signal<SelectOption[]>([]);

  protected readonly form = new FormGroup({
    description: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    scopeLocationId: new FormControl<number | null>(null),
    countDate: new FormControl<Date | null>(todayStart(), [Validators.required]),
    blindCount: new FormControl<boolean>(true, { nonNullable: true }),
    recountTolerancePercent: new FormControl<number | null>(0, [Validators.min(0), Validators.max(100)]),
    notes: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    countDate: this.translate.instant('physicalInventory.countDate'),
    recountTolerancePercent: this.translate.instant('physicalInventory.recountTolerance'),
  });

  constructor() {
    this.inventory.getLocationTree().subscribe({
      next: tree => this.scopeOptions.set([
        { value: null, label: this.translate.instant('physicalInventory.wholeSite') },
        ...this.flatten(tree, ''),
      ]),
      error: () => this.scopeOptions.set([{ value: null, label: this.translate.instant('physicalInventory.wholeSite') }]),
    });
  }

  private flatten(nodes: StorageLocation[], prefix: string): SelectOption[] {
    return nodes.flatMap(node => {
      const path = prefix ? `${prefix} / ${node.name}` : node.name;
      return [{ value: node.id, label: path }, ...this.flatten(node.children ?? [], path)];
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.saving()) return;
    const f = this.form.getRawValue();
    this.saving.set(true);
    this.service.create({
      description: f.description.trim() || null,
      scopeLocationId: f.scopeLocationId,
      countDate: toDateOnly(f.countDate)!,
      blindCount: f.blindCount,
      recountTolerancePercent: f.recountTolerancePercent ?? 0,
      notes: f.notes.trim() || null,
    }).subscribe({
      next: created => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('physicalInventory.created', { number: created.inventoryNumber }));
        this.created.emit(created.id);
      },
      error: () => this.saving.set(false),
    });
  }
}
