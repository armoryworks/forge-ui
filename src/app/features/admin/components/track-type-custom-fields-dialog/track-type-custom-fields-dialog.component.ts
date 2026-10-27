import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { requiredTrimmed } from '../../../../shared/validators/required-trimmed.validator';
import { CustomFieldDefinition } from '../../../../shared/models/custom-field-definition.model';
import { AdminService } from '../../services/admin.service';

export interface TrackTypeCustomFieldsDialogData {
  trackTypeId: number;
  trackTypeName: string;
}

type FieldRow = FormGroup<{
  label: FormControl<string>;
  key: FormControl<string>;
  type: FormControl<CustomFieldDefinition['type']>;
  isRequired: FormControl<boolean>;
  options: FormControl<string>;
}>;

/** Slug used as a custom field's storage key when none is typed: lower case, words joined by underscores. */
export function customFieldKey(label: string): string {
  return label.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100);
}

/** Edits the custom fields a track type's jobs carry: label, key, type, required, select options and display order. */
@Component({
  selector: 'app-track-type-custom-fields-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './track-type-custom-fields-dialog.component.html',
  styleUrl: './track-type-custom-fields-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrackTypeCustomFieldsDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<TrackTypeCustomFieldsDialogComponent, boolean | undefined>);
  private readonly admin = inject(AdminService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<TrackTypeCustomFieldsDialogData>(MAT_DIALOG_DATA);

  protected readonly loading = signal(true);
  protected readonly saving = signal(false);

  protected readonly typeOptions: SelectOption[] = [
    { value: 'text', label: this.translate.instant('admin.customFields.types.text') },
    { value: 'number', label: this.translate.instant('admin.customFields.types.number') },
    { value: 'date', label: this.translate.instant('admin.customFields.types.date') },
    { value: 'select', label: this.translate.instant('admin.customFields.types.select') },
    { value: 'toggle', label: this.translate.instant('admin.customFields.types.toggle') },
  ];

  protected readonly fields = new FormArray<FieldRow>([], { validators: control => this.duplicateKeys(control) });
  protected readonly form = new FormGroup({ fields: this.fields });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    fields: this.translate.instant('admin.customFields.title'),
  });

  constructor() {
    this.admin.getCustomFieldDefinitions(this.data.trackTypeId).subscribe({
      next: defs => {
        for (const def of defs ?? []) this.fields.push(this.row(def));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected add(): void {
    this.fields.push(this.row({ key: '', label: '', type: 'text', isRequired: false, options: null }));
  }

  protected remove(index: number): void {
    this.fields.removeAt(index);
  }

  protected move(index: number, offset: -1 | 1): void {
    const target = index + offset;
    if (target < 0 || target >= this.fields.length) return;
    const row = this.fields.at(index);
    this.fields.removeAt(index);
    this.fields.insert(target, row);
  }

  protected fillKey(index: number): void {
    const row = this.fields.at(index);
    if (!row.controls.key.value.trim()) row.controls.key.setValue(customFieldKey(row.controls.label.value));
  }

  private row(def: CustomFieldDefinition): FieldRow {
    const group: FieldRow = new FormGroup({
      label: new FormControl(def.label, { nonNullable: true, validators: [requiredTrimmed, Validators.maxLength(200)] }),
      key: new FormControl(def.key, { nonNullable: true, validators: [requiredTrimmed, Validators.maxLength(100), Validators.pattern(/^[A-Za-z0-9_]+$/)] }),
      type: new FormControl<CustomFieldDefinition['type']>(def.type, { nonNullable: true }),
      isRequired: new FormControl(def.isRequired, { nonNullable: true }),
      options: new FormControl((def.options ?? []).join(', '), { nonNullable: true }),
    }, { validators: control => this.optionsError(control) });
    return group;
  }

  private optionsError(control: AbstractControl): ValidationErrors | null {
    const { type, options } = (control as FieldRow).getRawValue();
    return type !== 'select' || this.splitOptions(options).length > 0
      ? null
      : { options: { message: this.translate.instant('admin.customFields.optionsRequired') } };
  }

  private duplicateKeys(control: AbstractControl): ValidationErrors | null {
    const keys = (control as FormArray<FieldRow>).getRawValue().map(r => r.key.trim().toLowerCase()).filter(k => k.length > 0);
    return new Set(keys).size === keys.length
      ? null
      : { fields: { message: this.translate.instant('admin.customFields.duplicateKey') } };
  }

  private splitOptions(options: string): string[] {
    return options.split(',').map(o => o.trim()).filter(o => o.length > 0);
  }

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const definitions: CustomFieldDefinition[] = this.fields.getRawValue().map(r => ({
      key: r.key.trim(),
      label: r.label.trim(),
      type: r.type,
      isRequired: r.isRequired,
      options: r.type === 'select' ? this.splitOptions(r.options) : null,
    }));
    this.saving.set(true);
    this.admin.updateCustomFieldDefinitions(this.data.trackTypeId, definitions).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('admin.customFields.saved'));
        this.dialogRef.close(true);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.snackbar.errorFrom(err, 'admin.customFields.saveFailed');
      },
    });
  }
}
