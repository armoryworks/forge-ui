import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService, SetupTokenInfo } from '../../shared/services/auth.service';
import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-token-setup',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatButtonModule, InputComponent, ValidationPopoverDirective],
  templateUrl: './token-setup.component.html',
  styleUrl: './token-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenSetupComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly loadingService = inject(LoadingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);

  protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  protected readonly error = signal<string | null>(null);
  protected readonly tokenInfo = signal<SetupTokenInfo | null>(null);

  ngOnInit(): void {
    if (!this.token) {
      this.error.set('Invalid setup link. Please contact your administrator.');
      return;
    }

    this.authService.validateSetupToken(this.token).subscribe({
      next: (info) => this.tokenInfo.set(info),
      error: () => this.error.set('Invalid or expired setup code. Please contact your administrator.'),
    });
  }

  protected readonly form = new FormGroup({
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirmPassword: new FormControl('', [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    password: 'Password',
    confirmPassword: 'Confirm Password',
  });

  protected readonly loading = this.loadingService.isLoading;

  protected onSubmit(): void {
    if (this.form.invalid) return;

    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.snackbar.error('Passwords do not match.');
      return;
    }

    if (!this.token) {
      this.error.set('Invalid setup link. Please contact your administrator.');
      return;
    }

    this.loadingService.track('Setting up your account...', this.authService.completeSetup({
      token: this.token,
      password: password!,
    })).subscribe({
      next: (response) => {
        this.snackbar.success('Account setup complete. Welcome!');
        this.router.navigate([response.user.profileComplete ? '/dashboard' : '/account/profile']);
      },
      error: (err: HttpErrorResponse) => {
        const detail = err.error?.detail ?? err.error?.title ?? 'Setup failed.';
        if (err.status >= 500) {
          this.toast.show({ severity: 'error', title: 'Setup failed', message: detail });
        } else {
          this.error.set(detail);
        }
      },
    });
  }
}
