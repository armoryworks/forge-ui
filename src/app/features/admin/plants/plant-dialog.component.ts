import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { requiredTrimmed } from '../../../shared/validators/required-trimmed.validator';
import { CompanyLocation } from '../models/company-location.model';
import { Plant } from '../models/plant.model';
import { PlantRequest } from '../models/plant-request.model';
import { plantTimeZones } from './plant-time-zones.const';

export interface PlantDialogData {
  plant?: Plant;
  locations: CompanyLocation[];
}

/** Creates or edits a plant: its code, name, the company location (address) it sits at, time zone, currency and default flag. */
@Component({
  selector: 'app-plant-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './plant-dialog.component.html',
  styleUrl: './plant-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlantDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<PlantDialogComponent, PlantRequest | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<PlantDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.plant;

  protected readonly locationOptions: SelectOption[] = this.data.locations
    .filter(l => l.isActive || l.id === this.data.plant?.companyLocationId)
    .map(l => ({ value: l.id, label: `${l.name} — ${[l.line1, l.city, l.state].filter(Boolean).join(', ')}` }));

  protected readonly timeZoneOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('admin.plants.noTimeZone') },
    ...plantTimeZones().map(z => ({ value: z, label: z })),
  ];

  protected readonly form = new FormGroup({
    code: new FormControl<string>(this.data.plant?.code ?? '', { nonNullable: true, validators: [requiredTrimmed, Validators.maxLength(20)] }),
    name: new FormControl<string>(this.data.plant?.name ?? '', { nonNullable: true, validators: [requiredTrimmed, Validators.maxLength(200)] }),
    companyLocationId: new FormControl<number | null>(this.data.plant?.companyLocationId ?? this.defaultLocationId(), [Validators.required]),
    timeZone: new FormControl<string | null>(this.data.plant?.timeZone ?? null),
    currencyCode: new FormControl<string>(this.data.plant?.currencyCode ?? '', { nonNullable: true, validators: [Validators.pattern(/^[A-Za-z]{3}$|^$/)] }),
    isActive: new FormControl<boolean>(this.data.plant?.isActive ?? true, { nonNullable: true }),
    isDefault: new FormControl<boolean>(this.data.plant?.isDefault ?? false, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    code: this.translate.instant('admin.plants.code'),
    name: this.translate.instant('admin.plants.name'),
    companyLocationId: this.translate.instant('admin.plants.location'),
    currencyCode: this.translate.instant('admin.plants.currency'),
  });

  private defaultLocationId(): number | null {
    const active = this.data.locations.filter(l => l.isActive);
    return (active.find(l => l.isDefault) ?? active[0])?.id ?? null;
  }

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    const currency = f.currencyCode.trim().toUpperCase();
    this.dialogRef.close({
      code: f.code.trim(),
      name: f.name.trim(),
      companyLocationId: f.companyLocationId!,
      timeZone: f.timeZone || null,
      currencyCode: currency || null,
      isActive: f.isActive,
      isDefault: f.isDefault,
    });
  }
}
