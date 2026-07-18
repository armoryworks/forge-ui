import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { toIsoDate, todayEnd } from '../../../../shared/utils/date.utils';

import { CustomerService } from '../../services/customer.service';
import { ContactInteraction } from '../../models/contact-interaction.model';

export interface ContactInteractionDialogData {
  /** Owning customer — required for the create/update POST path. */
  customerId: number;
  /** Null = create mode; populated = edit mode. */
  interaction: ContactInteraction | null;
  /** Optional contact to pre-select in create mode (deep-linked from a contact row). */
  defaultContactId?: number | null;
}

/**
 * Single source of truth for the log/edit contact-interaction form (CRM
 * activity log). Opened via MatDialog from BOTH the Interactions cluster
 * (list toolbar + row edit) and the Recent Communications widget's inline
 * "Log" affordance on the customer overview surface, so the form lives in
 * exactly one place. Returns the saved ContactInteraction on success, or
 * null when cancelled.
 */
@Component({
  selector: 'app-contact-interaction-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    DatepickerComponent, ValidationButtonComponent,
  ],
  templateUrl: './contact-interaction-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactInteractionDialogComponent {
  private readonly customerService = inject(CustomerService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly dialogRef = inject(MatDialogRef<ContactInteractionDialogComponent, ContactInteraction | null>);
  protected readonly data = inject<ContactInteractionDialogData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly isEdit = !!this.data.interaction;

  protected readonly contactOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('customers.interactions.noContact') },
  ]);

  protected readonly formTypeOptions: SelectOption[] = [
    { value: 'Call', label: this.translate.instant('customers.interactions.types.Call') },
    { value: 'Email', label: this.translate.instant('customers.interactions.types.Email') },
    { value: 'Meeting', label: this.translate.instant('customers.interactions.types.Meeting') },
    { value: 'Note', label: this.translate.instant('customers.interactions.types.Note') },
  ];

  /** Interactions log a thing that already happened — future dates make no
   *  sense; [max]=today is safe on edit (existing past dates still pass). */
  protected readonly today = todayEnd();

  protected readonly title = computed(() =>
    this.isEdit
      ? this.translate.instant('customers.interactions.editInteraction')
      : this.translate.instant('customers.interactions.logInteraction'),
  );

  protected readonly form = new FormGroup({
    contactId: new FormControl<number | null>(
      this.data.interaction?.contactId ?? this.data.defaultContactId ?? null,
    ),
    type: new FormControl(this.data.interaction?.type ?? 'Call', [Validators.required]),
    subject: new FormControl(this.data.interaction?.subject ?? '', [Validators.required, Validators.maxLength(200)]),
    body: new FormControl<string | null>(this.data.interaction?.body ?? null),
    interactionDate: new FormControl<Date | null>(
      this.data.interaction ? new Date(this.data.interaction.interactionDate) : new Date(),
      [Validators.required],
    ),
    durationMinutes: new FormControl<number | null>(this.data.interaction?.durationMinutes ?? null),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    type: this.translate.instant('customers.interactions.violations.type'),
    subject: this.translate.instant('customers.interactions.violations.subject'),
    interactionDate: this.translate.instant('customers.interactions.violations.date'),
  });

  constructor() {
    this.customerService.getCustomerById(this.data.customerId).subscribe({
      next: (customer) => {
        const contacts = (customer as { contacts?: { id: number; firstName: string; lastName: string }[] }).contacts ?? [];
        this.contactOptions.set([
          { value: null, label: this.translate.instant('customers.interactions.noContact') },
          ...contacts.map(c => ({ value: c.id, label: `${c.lastName}, ${c.firstName}` })),
        ]);
      },
    });
  }

  close(): void {
    this.dialogRef.close(null);
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const val = this.form.getRawValue();
    const request = {
      contactId: val.contactId,
      type: val.type!,
      subject: val.subject!,
      body: val.body,
      interactionDate: toIsoDate(val.interactionDate) ?? new Date().toISOString(),
      durationMinutes: val.durationMinutes,
    };

    const existing = this.data.interaction;
    const op = existing
      ? this.customerService.updateInteraction(this.data.customerId, existing.id, request)
      : this.customerService.createInteraction(this.data.customerId, request);

    op.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(existing ? 'customers.interactions.updated' : 'customers.interactions.logged'));
        this.dialogRef.close(result);
      },
      error: () => this.saving.set(false),
    });
  }
}
