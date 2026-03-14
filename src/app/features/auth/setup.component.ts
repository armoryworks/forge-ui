import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../shared/services/auth.service';
import { InputComponent } from '../../shared/components/input/input.component';
import { AddressFormComponent } from '../../shared/components/address-form/address-form.component';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatCardModule, MatButtonModule,
    InputComponent, AddressFormComponent, ValidationPopoverDirective,
  ],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly loadingService = inject(LoadingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);

  protected readonly step = signal(1);
  protected readonly loading = this.loadingService.isLoading;

  // Step 1: Admin Account
  protected readonly accountForm = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  protected readonly accountViolations = FormValidationService.getViolations(this.accountForm, {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
  });

  // Step 2: Company Details
  protected readonly companyForm = new FormGroup({
    companyName: new FormControl('', [Validators.required, Validators.maxLength(200)]),
    companyPhone: new FormControl(''),
    companyEmail: new FormControl('', [Validators.email]),
    companyEin: new FormControl(''),
    companyWebsite: new FormControl(''),
    locationName: new FormControl('Main Office'),
    address: new FormControl<Record<string, string> | null>(null),
  });

  protected readonly companyViolations = FormValidationService.getViolations(this.companyForm, {
    companyName: 'Company Name',
    companyEmail: 'Company Email',
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

    this.loadingService.track('Setting up...', this.authService.setup({
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
      next: () => this.router.navigate(['/dashboard']),
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
