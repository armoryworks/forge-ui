import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, ReactiveFormsModule, FormGroup, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../shared/services/auth.service';
import { InputComponent } from '../../shared/components/input/input.component';
import { AddressFormComponent } from '../../shared/components/address-form/address-form.component';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { LayoutService } from '../../shared/services/layout.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatButtonModule, TranslatePipe,
    InputComponent, AddressFormComponent, ValidationButtonComponent,
  ],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  private readonly loadingService = inject(LoadingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly step = signal(1);
  protected readonly loading = this.loadingService.isLoading;

  // Step 1: Admin Account
  // confirmPassword catches typos on the masked password field — this is
  // the FIRST admin account on the install, so a typo locks the user
  // out. The visibility-toggle eye on the password input is helpful but
  // not sufficient; standard pattern is to also require a re-entry.
  protected readonly accountForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(8),
      passwordStrengthValidator,
    ]),
    confirmPassword: new FormControl('', [
      Validators.required,
      passwordsMatchValidator,
    ]),
  });

  protected readonly accountViolations = FormValidationService.getViolations(this.accountForm, {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
  });

  constructor() {
    // When the password changes, re-run confirmPassword's validators so
    // the popover stays in sync with the latest match state (otherwise
    // confirmPassword's validator only fires on its own valueChanges).
    this.accountForm.controls.password.valueChanges.subscribe(() => {
      this.accountForm.controls.confirmPassword.updateValueAndValidity({ emitEvent: false });
    });
  }

  // Step 2: Company Details
  // The `address` control wraps a Record<string,string> from
  // AddressFormComponent (line1 / city / state / postalCode, etc.).
  // AddressFormComponent renders visual `*` marks on its required
  // fields but its own internal Validators don't propagate up to this
  // parent FormControl — so the validation popover would silently miss
  // them. addressRequiredValidator below surfaces one entry per missing
  // required address field so the visual `*` and the popover stay in sync.
  protected readonly companyForm = new FormGroup({
    companyName: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    companyPhone: new FormControl(''),
    companyEmail: new FormControl('', [Validators.email]),
    companyEin: new FormControl(''),
    companyWebsite: new FormControl(''),
    locationName: new FormControl('Main Office'),
    address: new FormControl<Record<string, string> | null>(null, [addressRequiredValidator]),
  });

  protected readonly companyViolations = FormValidationService.getViolations(this.companyForm, {
    companyName: 'Company Name',
    companyEmail: 'Company Email',
    address: 'Address',
  });

  protected nextStep(): void {
    if (this.accountForm.invalid) return;
    this.step.set(2);
  }

  protected prevStep(): void {
    this.step.set(1);
  }

  protected onSubmit(): void {
    if (this.accountForm.invalid) return;

    const account = this.accountForm.getRawValue();
    const company = this.companyForm.getRawValue();
    const address = company.address as Record<string, string> | null;

    this.loadingService.track(this.translate.instant('auth.settingUp'), this.authService.setup({
      email: account.email!,
      password: account.password!,
      firstName: account.firstName!,
      lastName: account.lastName!,
      companyName: company.companyName || undefined,
      companyPhone: company.companyPhone || undefined,
      companyEmail: company.companyEmail || undefined,
      companyEin: company.companyEin || undefined,
      companyWebsite: company.companyWebsite || undefined,
      locationName: company.locationName || undefined,
      locationLine1: address?.['line1'] || undefined,
      locationLine2: address?.['line2'] || undefined,
      locationCity: address?.['city'] || undefined,
      locationState: address?.['state'] || undefined,
      locationPostalCode: address?.['postalCode'] || undefined,
    })).subscribe({
      next: () => this.router.navigate([this.layout.getDefaultRoute()]),
      error: (err: HttpErrorResponse) => this.handleError(err),
    });
  }

  private handleError(err: HttpErrorResponse): void {
    const detail = err.error?.detail;
    const status = err.status;

    if (status >= 500 || err.error?.stackTrace || err.error?.traceId) {
      this.toast.show({
        severity: 'error',
        title: 'Setup failed',
        message: detail ?? 'An unexpected server error occurred.',
        details: err.error?.stackTrace ?? `Status ${status}: ${err.statusText}`,
      });
    } else {
      this.snackbar.error(detail ?? 'Setup failed. Please try again.');
    }
  }
}

/**
 * Replaces the old [info] hint on the password field. Each missing
 * requirement surfaces as its own violation in the validation popover
 * (via FormValidationService — the service reads the `message` property
 * directly when an error value has one), so users see exactly what's
 * still needed instead of one generic "invalid" line.
 *
 * Intentionally does NOT short-circuit on empty value — the requirements
 * fire even for a blank field so the popover surfaces them up-front
 * alongside "Password is required" (from Validators.required). Users
 * learn what's needed before they start typing instead of discovering
 * each rule one keystroke at a time.
 */
function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value as string | null | undefined) ?? '';

  const errors: ValidationErrors = {};
  if (!/[A-Z]/.test(value)) errors['passwordUppercase'] = { message: 'Password must contain an uppercase letter' };
  if (!/[a-z]/.test(value)) errors['passwordLowercase'] = { message: 'Password must contain a lowercase letter' };
  if (!/[0-9]/.test(value)) errors['passwordDigit'] = { message: 'Password must contain a digit' };
  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Cross-field validator on confirmPassword that fires when its value
 * is non-empty but doesn't match the sibling `password` control. Lives
 * on confirmPassword (not on the form) so FormValidationService picks
 * it up — the service iterates per-control errors, not form-level ones.
 */
function passwordsMatchValidator(control: AbstractControl): ValidationErrors | null {
  const confirm = control.value as string | null | undefined;
  if (!confirm) return null;  // `required` covers the empty case.
  const password = control.parent?.get('password')?.value as string | null | undefined;
  if (password && confirm !== password) {
    return { passwordsMismatch: { message: 'Passwords must match' } };
  }
  return null;
}

/**
 * Surfaces per-field violations matching the visual `*` marks
 * AddressFormComponent renders on its required line1 / city / state /
 * postalCode controls. The child component's internal validators don't
 * propagate up to the parent's `address` FormControl, so without this
 * the validation popover would silently miss them.
 */
function addressRequiredValidator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? {}) as Record<string, string | null | undefined>;

  const isBlank = (v: string | null | undefined) => !v || !v.trim();
  const errors: ValidationErrors = {};
  if (isBlank(value['line1'])) errors['streetRequired'] = { message: 'Street Address is required' };
  if (isBlank(value['city'])) errors['cityRequired'] = { message: 'City is required' };
  if (isBlank(value['state'])) errors['stateRequired'] = { message: 'State is required' };
  if (isBlank(value['postalCode'])) errors['postalRequired'] = { message: 'ZIP / Postal Code is required' };
  return Object.keys(errors).length > 0 ? errors : null;
}
