import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../shared/services/auth.service';
import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-setup',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatButtonModule, InputComponent, ValidationPopoverDirective],
  templateUrl: './setup.component.html',
  styleUrl: './setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetupComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);

  protected readonly form = new FormGroup({
    firstName: new FormControl('', [Validators.required]),
    lastName: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
  });

  protected readonly loading = signal(false);

  protected onSubmit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);

    const { email, password, firstName, lastName } = this.form.getRawValue();

    this.authService
      .setup({
        email: email!,
        password: password!,
        firstName: firstName!,
        lastName: lastName!,
      })
      .subscribe({
        next: () => this.router.navigate(['/dashboard']),
        error: (err: HttpErrorResponse) => {
          this.loading.set(false);
          this.handleError(err);
        },
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
