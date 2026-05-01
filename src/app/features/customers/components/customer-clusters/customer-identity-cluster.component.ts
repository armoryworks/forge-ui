import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { ToggleComponent } from '../../../../shared/components/toggle/toggle.component';
import { ValidationButtonComponent } from '../../../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { CustomerSummary } from '../../models/customer-summary.model';

/**
 * Pillar 5 — Customer identity & contact cluster.
 *
 * Renders read-only or edit form for the customer's identity fields:
 * Name, Company Name, Email, Phone, IsActive (status). External-system
 * fields (provider / externalId) are read-only when present.
 *
 * Used as the default `overview` tab on the Customer detail page across
 * every lifecycle (Active / Prospect / Archived).
 */
@Component({
  selector: 'app-customer-identity-cluster',
  standalone: true,
  imports: [
    ReactiveFormsModule, TranslatePipe,
    InputComponent, ToggleComponent, ValidationButtonComponent,
  ],
  templateUrl: './customer-identity-cluster.component.html',
  styleUrl: './customer-clusters.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerIdentityClusterComponent {
  readonly customer = input.required<CustomerSummary>();
  readonly editing = input(false);
  readonly saving = input(false);

  readonly save = output<Partial<CustomerSummary>>();
  readonly cancelled = output<void>();

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    companyName: new FormControl<string>('', { nonNullable: true }),
    email: new FormControl<string>('', { nonNullable: true, validators: [Validators.email, Validators.maxLength(200)] }),
    phone: new FormControl<string>('', { nonNullable: true }),
    isActive: new FormControl<boolean>(true, { nonNullable: true }),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    name: 'Name',
    email: 'Email',
  });

  constructor() {
    effect(() => {
      const c = this.customer();
      this.form.reset({
        name: c.name,
        companyName: c.companyName ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        isActive: c.isActive,
      });
      if (this.editing()) {
        this.form.enable();
      } else {
        this.form.disable();
      }
    });
  }

  protected onSave(): void {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.save.emit({
      name: v.name,
      companyName: v.companyName || undefined,
      email: v.email || undefined,
      phone: v.phone || undefined,
      isActive: v.isActive,
    });
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }
}
