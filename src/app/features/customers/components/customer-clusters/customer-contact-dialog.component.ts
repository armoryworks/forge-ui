import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { EntityPickerComponent } from '../../../../shared/components/entity-picker/entity-picker.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { Contact } from '../../models/contact.model';
import { CustomerService } from '../../services/customer.service';

/**
 * Create/edit dialog for a customer contact. Extracted from the inline
 * dialog that used to live in `customer-contacts-cluster.component.html`
 * (mirrors `CustomerAddressDialogComponent`'s shape) so two surfaces can
 * share it:
 *
 *  - **Customer detail → Contacts tab** (the cluster): `customerId` is
 *    bound, the customer picker is hidden — identical UX to before.
 *  - **Top-level /customers/contacts page**: `customerId` is null, so the
 *    dialog surfaces a required customer `<app-entity-picker>` first — the
 *    cross-customer add flow selects the account before the person.
 *
 * `contact` null = create mode; populated = edit mode (cluster only).
 * The dialog owns the save round-trip + success snackbar; parents refresh
 * on `saved` and unmount on `closed`.
 */
@Component({
  selector: 'app-customer-contact-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, EntityPickerComponent, InputComponent, SelectComponent,
    ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './customer-contact-dialog.component.html',
  styleUrl: './customer-contact-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerContactDialogComponent implements OnInit {
  private readonly customerService = inject(CustomerService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  /** Null = cross-customer mode: the dialog renders a required customer picker. */
  readonly customerId = input<number | null>(null);
  /** Null = create mode; populated = edit mode. */
  readonly contact = input<Contact | null>(null);

  /** Emitted after a successful create/update with the target customer id. */
  readonly saved = output<number>();
  /** Emitted when the user dismisses without saving. */
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  protected readonly roleOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('customers.roleOptions.none') },
  ]);

  protected readonly title = computed(() =>
    this.translate.instant(this.contact() ? 'customers.editContact' : 'customers.newContact'),
  );

  /** True when the dialog must ask which customer the contact belongs to. */
  protected readonly needsCustomerSelection = computed(() => this.customerId() === null);

  protected readonly form = new FormGroup({
    customerId: new FormControl<number | null>(null, [Validators.required]),
    firstName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    lastName: new FormControl('', [Validators.required, Validators.maxLength(100)]),
    email: new FormControl('', [Validators.email, Validators.maxLength(200)]),
    phone: new FormControl(''),
    role: new FormControl<string | null>(null),
    isPrimary: new FormControl(false),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    customerId: this.translate.instant('customers.contactDialog.customerField'),
    firstName: this.translate.instant('customers.contactsCluster.violations.firstName'),
    lastName: this.translate.instant('customers.contactsCluster.violations.lastName'),
    email: this.translate.instant('customers.contactsCluster.violations.email'),
  });

  constructor() {
    // Hydrate once — parents mount this component fresh per open (@if), so
    // both inputs are effectively set-once (same pattern as the address dialog).
    effect(() => {
      const cid = this.customerId();
      if (cid !== null) this.form.controls.customerId.setValue(cid);
    });
    effect(() => {
      const c = this.contact();
      if (!c) return;
      this.form.patchValue({
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email ?? '',
        phone: c.phone ?? '',
        role: c.role ?? null,
        isPrimary: c.isPrimary,
      });
    });
  }

  ngOnInit(): void {
    this.refDataService.getAsOptions('contact_role', {
      allLabel: this.translate.instant('customers.roleOptions.none'),
      valueField: 'label',
    }).subscribe(opts => this.roleOptions.set(opts));
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.value;
    const targetCustomerId = v.customerId!;
    const payload = {
      firstName: v.firstName!,
      lastName: v.lastName!,
      email: v.email || undefined,
      phone: v.phone || undefined,
      role: v.role ?? undefined,
      isPrimary: v.isPrimary ?? false,
    };

    this.saving.set(true);
    const existing = this.contact();
    const obs = existing
      ? this.customerService.updateContact(targetCustomerId, existing.id, payload)
      : this.customerService.createContact(targetCustomerId, payload);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(existing ? 'customers.contactUpdated' : 'customers.contactCreated'));
        this.saved.emit(targetCustomerId);
      },
      error: () => this.saving.set(false),
    });
  }
}
