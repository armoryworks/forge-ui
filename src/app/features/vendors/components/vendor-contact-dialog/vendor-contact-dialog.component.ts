import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Observable } from 'rxjs';

import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ReferenceDataService } from '../../../../shared/services/reference-data.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

import { VendorContact } from '../../models/vendor-contact.model';
import { VendorContactRequest } from '../../models/vendor-contact-request.model';
import { VendorService } from '../../services/vendor.service';

@Component({
  selector: 'app-vendor-contact-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent,
    ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './vendor-contact-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorContactDialogComponent implements OnInit {
  private readonly vendorService = inject(VendorService);
  private readonly refDataService = inject(ReferenceDataService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly vendorId = input.required<number>();
  readonly contact = input<VendorContact | null>(null);

  readonly saved = output<void>();
  readonly closed = output<void>();

  protected readonly saving = signal(false);

  protected readonly roleOptions = signal<SelectOption[]>([
    { value: null, label: this.translate.instant('vendorContacts.contactDialog.noRole') },
  ]);

  protected readonly title = computed(() =>
    this.translate.instant(this.contact() ? 'vendorContacts.contactDialog.editTitle' : 'vendorContacts.contactDialog.addTitle'),
  );

  protected readonly form = new FormGroup({
    firstName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    role: new FormControl<string | null>(null),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(200)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    mobile: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    fax: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    isPrimary: new FormControl(false, { nonNullable: true }),
    notes: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    firstName: this.translate.instant('vendorContacts.contactDialog.firstName'),
    lastName: this.translate.instant('vendorContacts.contactDialog.lastName'),
    email: this.translate.instant('common.email'),
    phone: this.translate.instant('common.phone'),
    mobile: this.translate.instant('vendorContacts.contactDialog.mobile'),
    fax: this.translate.instant('common.fax'),
    notes: this.translate.instant('common.notes'),
  });

  constructor() {
    effect(() => {
      const c = this.contact();
      if (!c) return;
      this.form.patchValue({
        firstName: c.firstName,
        lastName: c.lastName,
        role: c.role,
        email: c.email ?? '',
        phone: c.phone ?? '',
        mobile: c.mobile ?? '',
        fax: c.fax ?? '',
        isPrimary: c.isPrimary,
        notes: c.notes ?? '',
      });
    });
  }

  ngOnInit(): void {
    this.refDataService.getByGroup('contact_role').subscribe(items => {
      const current = this.contact()?.role ?? null;
      const options: SelectOption[] = items
        .filter(i => i.isActive && i.code !== 'primary')
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(i => ({ value: i.label, label: i.label }));
      if (current && !options.some(o => o.value === current)) {
        options.push({ value: current, label: current });
      }
      this.roleOptions.set([
        { value: null, label: this.translate.instant('vendorContacts.contactDialog.noRole') },
        ...options,
      ]);
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid || this.saving()) return;
    const v = this.form.getRawValue();
    const payload: VendorContactRequest = {
      firstName: v.firstName.trim(),
      lastName: v.lastName.trim(),
      role: v.role,
      email: v.email.trim() || null,
      phone: v.phone.trim() || null,
      mobile: v.mobile.trim() || null,
      fax: v.fax.trim() || null,
      isPrimary: v.isPrimary,
      notes: v.notes.trim() || null,
    };

    this.saving.set(true);
    const existing = this.contact();
    const request: Observable<VendorContact> = existing
      ? this.vendorService.updateContact(this.vendorId(), existing.id, payload)
      : this.vendorService.createContact(this.vendorId(), payload);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant(existing ? 'vendorContacts.contactUpdated' : 'vendorContacts.contactAdded'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
