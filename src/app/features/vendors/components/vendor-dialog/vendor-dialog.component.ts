import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { VendorService } from '../../services/vendor.service';
import { VendorDetail } from '../../models/vendor-detail.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-vendor-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, InputComponent, SelectComponent, TextareaComponent, ToggleComponent,
    ValidationPopoverDirective,
  ],
  templateUrl: './vendor-dialog.component.html',
  styleUrl: './vendor-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorDialogComponent {
  private readonly vendorService = inject(VendorService);
  private readonly snackbar = inject(SnackbarService);

  readonly vendor = input<VendorDetail | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);

  protected readonly form = new FormGroup({
    companyName: new FormControl('', [Validators.required]),
    contactName: new FormControl(''),
    email: new FormControl('', [Validators.email]),
    phone: new FormControl(''),
    address: new FormControl(''),
    city: new FormControl(''),
    state: new FormControl(''),
    zipCode: new FormControl(''),
    country: new FormControl(''),
    paymentTerms: new FormControl(''),
    notes: new FormControl(''),
    isActive: new FormControl(true),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    companyName: 'Company Name',
    contactName: 'Contact Name',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    city: 'City',
    state: 'State',
    zipCode: 'Zip Code',
    country: 'Country',
    paymentTerms: 'Payment Terms',
    notes: 'Notes',
    isActive: 'Active',
  });

  protected readonly paymentTermsOptions: SelectOption[] = [
    { value: '', label: '-- None --' },
    { value: 'Net 15', label: 'Net 15' },
    { value: 'Net 30', label: 'Net 30' },
    { value: 'Net 45', label: 'Net 45' },
    { value: 'Net 60', label: 'Net 60' },
    { value: 'Due on Receipt', label: 'Due on Receipt' },
    { value: 'COD', label: 'COD' },
  ];

  constructor() {
    const v = this.vendor();
    if (v) {
      this.form.patchValue({
        companyName: v.companyName,
        contactName: v.contactName ?? '',
        email: v.email ?? '',
        phone: v.phone ?? '',
        address: v.address ?? '',
        city: v.city ?? '',
        state: v.state ?? '',
        zipCode: v.zipCode ?? '',
        country: v.country ?? '',
        paymentTerms: v.paymentTerms ?? '',
        notes: v.notes ?? '',
        isActive: v.isActive,
      });
    }
  }

  protected get isEditing(): boolean {
    return this.vendor() !== null;
  }

  protected close(): void {
    this.closed.emit();
  }

  protected save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const f = this.form.getRawValue();
    const v = this.vendor();

    if (v) {
      this.vendorService.updateVendor(v.id, {
        companyName: f.companyName || undefined,
        contactName: f.contactName || undefined,
        email: f.email || undefined,
        phone: f.phone || undefined,
        address: f.address || undefined,
        city: f.city || undefined,
        state: f.state || undefined,
        zipCode: f.zipCode || undefined,
        country: f.country || undefined,
        paymentTerms: f.paymentTerms || undefined,
        notes: f.notes || undefined,
        isActive: f.isActive ?? true,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success('Vendor updated.');
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.vendorService.createVendor({
        companyName: f.companyName!,
        contactName: f.contactName || undefined,
        email: f.email || undefined,
        phone: f.phone || undefined,
        address: f.address || undefined,
        city: f.city || undefined,
        state: f.state || undefined,
        zipCode: f.zipCode || undefined,
        country: f.country || undefined,
        paymentTerms: f.paymentTerms || undefined,
        notes: f.notes || undefined,
      }).subscribe({
        next: () => {
          this.saving.set(false);
          this.snackbar.success('Vendor created.');
          this.saved.emit();
        },
        error: () => this.saving.set(false),
      });
    }
  }
}
