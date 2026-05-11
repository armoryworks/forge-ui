import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { FlatContactRow } from '../../models/flat-contact.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

export interface ProvisionPortalAccessDialogData {
  /** Contacts eligible to provision — caller pre-filters for emails-present + no-existing-access. */
  eligibleContacts: FlatContactRow[];
}

export interface ProvisionPortalAccessResult {
  contactId: number;
}

/**
 * Picks an existing contact to provision portal access for. Caller is
 * responsible for filtering the candidate list — typically contacts
 * with an email + no existing CustomerPortalAccess row.
 */
@Component({
  selector: 'app-provision-portal-access-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, SelectComponent, ValidationButtonComponent,
  ],
  templateUrl: './provision-portal-access-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProvisionPortalAccessDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ProvisionPortalAccessDialogComponent, ProvisionPortalAccessResult | undefined>);
  private readonly translate = inject(TranslateService);
  protected readonly data = inject<ProvisionPortalAccessDialogData>(MAT_DIALOG_DATA);

  protected readonly options: SelectOption[] = this.data.eligibleContacts
    .sort((a, b) => `${a.customerName} ${a.lastName}`.localeCompare(`${b.customerName} ${b.lastName}`))
    .map(c => ({
      value: c.contactId,
      label: `${c.customerName} — ${c.lastName}, ${c.firstName} <${c.email}>`,
    }));

  protected readonly form = new FormGroup({
    contactId: new FormControl<number | null>(null, [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    contactId: this.translate.instant('customers.portalAccessPage.provisionContactLabel'),
  });

  protected readonly hasEligible = this.data.eligibleContacts.length > 0;

  protected close(): void { this.dialogRef.close(); }

  protected confirm(): void {
    if (this.form.invalid) return;
    const contactId = this.form.controls.contactId.value!;
    this.dialogRef.close({ contactId });
  }
}
