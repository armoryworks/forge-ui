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
import { ActiveUser } from '../models/active-user.model';
import { ScanDevice } from '../models/scan-device.model';

export interface ScannerDialogData {
  device?: ScanDevice;
  users: ActiveUser[];
}

export interface ScannerDialogResult {
  deviceId: string;
  deviceName: string | null;
  assignedUserId: number | null;
  isActive: boolean;
}

/** Pairs a scanner (its id is scanned or typed from the device label) or edits its name, user and active flag. */
@Component({
  selector: 'app-scanner-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DialogComponent, InputComponent, SelectComponent, ToggleComponent, ValidationButtonComponent],
  templateUrl: './scanner-dialog.component.html',
  styleUrl: './scanner-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScannerDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ScannerDialogComponent, ScannerDialogResult | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<ScannerDialogData>(MAT_DIALOG_DATA);

  protected readonly isEdit = !!this.data.device;

  protected readonly userOptions: SelectOption[] = [
    { value: null, label: this.translate.instant('admin.scanners.unassigned') },
    ...this.data.users.map(u => ({ value: u.id, label: u.name })),
  ];

  protected readonly form = new FormGroup({
    deviceId: new FormControl<string>(
      { value: this.data.device?.deviceId ?? '', disabled: this.isEdit },
      { nonNullable: true, validators: [requiredTrimmed, Validators.maxLength(200)] }),
    deviceName: new FormControl<string>(this.data.device?.deviceName ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    assignedUserId: new FormControl<number | null>(this.data.device?.assignedUserId ?? null),
    isActive: new FormControl<boolean>(this.data.device?.isActive ?? true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    deviceId: this.translate.instant('admin.scanners.deviceId'),
    deviceName: this.translate.instant('admin.scanners.deviceName'),
  });

  protected close(): void { this.dialogRef.close(); }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    this.dialogRef.close({
      deviceId: f.deviceId.trim(),
      deviceName: f.deviceName.trim() || null,
      assignedUserId: f.assignedUserId ?? null,
      isActive: f.isActive,
    });
  }
}
