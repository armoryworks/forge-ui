import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ManualNumberSettingsService } from '../../../../shared/services/manual-number-settings.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { PartsService } from '../../services/parts.service';
import { PartDetail } from '../../models/part-detail.model';
import { ClonePartRequest } from '../../models/clone-part-request.model';

export interface ClonePartDialogData {
  part: PartDetail;
}

@Component({
  selector: 'app-clone-part-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, TextareaComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './clone-part-dialog.component.html',
  styleUrl: './clone-part-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClonePartDialogComponent {
  private readonly partsService = inject(PartsService);
  private readonly manualNumbers = inject(ManualNumberSettingsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<ClonePartDialogComponent, PartDetail | null>);
  protected readonly data = inject<ClonePartDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly allowManualPartNumber = computed(() => this.manualNumbers.isEnabled('parts'));

  protected readonly title = this.translate.instant('parts.clone.title', { partNumber: this.data.part.partNumber });

  protected readonly form = new FormGroup({
    name: new FormControl<string>(
      this.translate.instant('parts.clone.defaultName', { name: this.data.part.name }),
      { nonNullable: true, validators: [Validators.required, Validators.maxLength(256)] },
    ),
    partNumber: new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    description: new FormControl<string>(this.data.part.description ?? '', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    copyBom: new FormControl<boolean>(true, { nonNullable: true }),
    copyRouting: new FormControl<boolean>(true, { nonNullable: true }),
    copyVendorSources: new FormControl<boolean>(false, { nonNullable: true }),
  });

  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly materialsDropped = computed(() => {
    const v = this.formValue();
    return !!v.copyRouting && !v.copyBom;
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('parts.workflow.basics.nameLabel'),
    partNumber: this.translate.instant('partQuickCreate.partNumberLabel'),
    description: this.translate.instant('common.description'),
  });

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.partsService.clonePart(this.data.part.id, this.buildRequest()).subscribe({
      next: (created) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('parts.clone.created', { partNumber: created.partNumber }));
        this.dialogRef.close(created);
      },
      error: () => this.saving.set(false),
    });
  }

  private buildRequest(): ClonePartRequest {
    const v = this.form.getRawValue();
    const partNumber = v.partNumber.trim();
    return {
      name: v.name.trim(),
      description: v.description.trim(),
      copyBom: v.copyBom,
      copyRouting: v.copyRouting,
      copyVendorSources: v.copyVendorSources,
      ...(this.allowManualPartNumber() && partNumber ? { partNumber } : {}),
    };
  }
}
