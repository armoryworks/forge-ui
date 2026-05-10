import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { Account, CreateAccountRequest, UpdateAccountRequest } from '../../models/account.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

export interface AccountDialogData {
  account?: Account;
}

@Component({
  selector: 'app-account-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, TextareaComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './account-dialog.component.html',
  styleUrl: './account-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<AccountDialogComponent, CreateAccountRequest | UpdateAccountRequest | undefined>);
  protected readonly data = inject<AccountDialogData>(MAT_DIALOG_DATA);
  private readonly translate = inject(TranslateService);

  protected readonly isEdit = !!this.data.account;

  protected readonly sizeOptions: SelectOption[] = [
    { value: 'SMB', label: 'SMB (1-50)' },
    { value: 'Mid', label: 'Mid (51-500)' },
    { value: 'Enterprise', label: 'Enterprise (501+)' },
  ];

  protected readonly form = new FormGroup({
    name: new FormControl<string>(this.data.account?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    industry: new FormControl<string>(this.data.account?.industry ?? '', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    website: new FormControl<string>(this.data.account?.website ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    phone: new FormControl<string>(this.data.account?.phone ?? '', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    sizeBracket: new FormControl<string>(this.data.account?.sizeBracket ?? '', { nonNullable: true }),
    address: new FormControl<string>(this.data.account?.address ?? '', { nonNullable: true, validators: [Validators.maxLength(200)] }),
    city: new FormControl<string>(this.data.account?.city ?? '', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    state: new FormControl<string>(this.data.account?.state ?? '', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    postalCode: new FormControl<string>(this.data.account?.postalCode ?? '', { nonNullable: true, validators: [Validators.maxLength(20)] }),
    country: new FormControl<string>(this.data.account?.country ?? '', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    description: new FormControl<string>(this.data.account?.description ?? '', { nonNullable: true, validators: [Validators.maxLength(1000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: this.translate.instant('leads.accounts.fieldName'),
  });

  protected close(): void {
    this.dialogRef.close();
  }

  protected save(): void {
    if (this.form.invalid) return;
    const f = this.form.getRawValue();
    const payload = {
      name: f.name.trim(),
      industry: f.industry.trim() || null,
      website: f.website.trim() || null,
      phone: f.phone.trim() || null,
      sizeBracket: f.sizeBracket.trim() || null,
      address: f.address.trim() || null,
      city: f.city.trim() || null,
      state: f.state.trim() || null,
      postalCode: f.postalCode.trim() || null,
      country: f.country.trim() || null,
      description: f.description.trim() || null,
    };
    this.dialogRef.close(payload);
  }
}
