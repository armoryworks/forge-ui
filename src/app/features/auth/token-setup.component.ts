import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, ReactiveFormsModule, FormGroup, FormControl, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { HttpErrorResponse } from '@angular/common/http';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService, SetupTokenInfo } from '../../shared/services/auth.service';
import { BrandingService } from '../../shared/services/branding.service';
import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { LayoutService } from '../../shared/services/layout.service';
import { passwordStrengthValidator } from '../../shared/validators/password-strength.validator';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-token-setup',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, TranslatePipe, InputComponent, ValidationButtonComponent],
  templateUrl: './token-setup.component.html',
  styleUrl: './token-setup.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TokenSetupComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly layout = inject(LayoutService);
  private readonly loadingService = inject(LoadingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  protected readonly branding = inject(BrandingService);

  protected readonly token = this.route.snapshot.paramMap.get('token') ?? '';
  protected readonly error = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly tokenInfo = signal<SetupTokenInfo | null>(null);

  /**
   * Friendly greeting name. Collapses to just the first name when first and
   * last are identical (avoids "Welcome, Claude Claude") or when no last name
   * is present.
   */
  protected readonly welcomeName = computed(() => {
    const info = this.tokenInfo();
    if (!info) return '';
    const first = (info.firstName ?? '').trim();
    const last = (info.lastName ?? '').trim();
    if (!last || first.toLowerCase() === last.toLowerCase()) return first;
    return `${first} ${last}`;
  });

  ngOnInit(): void {
    if (!this.token) {
      this.error.set(this.translate.instant('auth.invalidSetupLink'));
      return;
    }

    this.authService.validateSetupToken(this.token).subscribe({
      next: (info) => this.tokenInfo.set(info),
      error: () => this.error.set(this.translate.instant('auth.expiredSetupCode')),
    });
  }

  private readonly passwordsMatch = (control: AbstractControl): ValidationErrors | null => {
    const confirm = control.value as string | null;
    const password = control.parent?.get('password')?.value as string | null | undefined;
    if (!confirm || !password || confirm === password) return null;
    return { passwordsMismatch: { message: this.translate.instant('account.passwordsDoNotMatch') } };
  };

  protected readonly form = new FormGroup({
    password: new FormControl('', [Validators.required, passwordStrengthValidator]),
    confirmPassword: new FormControl('', [Validators.required, this.passwordsMatch]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    password: this.translate.instant('auth.password'),
    confirmPassword: this.translate.instant('auth.confirmPassword'),
  });

  constructor() {
    this.form.controls.password.valueChanges.pipe(takeUntilDestroyed(inject(DestroyRef))).subscribe(() => {
      this.form.controls.confirmPassword.updateValueAndValidity({ emitEvent: false });
      this.form.updateValueAndValidity();
    });
  }

  protected readonly loading = this.loadingService.isLoading;

  protected onSubmit(): void {
    if (this.form.invalid) return;

    const { password } = this.form.getRawValue();

    if (!this.token) {
      this.error.set(this.translate.instant('auth.invalidSetupLink'));
      return;
    }

    this.submitError.set(null);
    this.loadingService.track(this.translate.instant('auth.settingUp'), this.authService.completeSetup({
      token: this.token,
      password: password!,
    })).subscribe({
      next: () => {
        this.snackbar.success(this.translate.instant('auth.setupComplete'));
        this.router.navigate([this.layout.getDefaultRoute()]);
      },
      error: (err: HttpErrorResponse) => {
        const detail: string = err.error?.detail ?? err.error?.title ?? this.translate.instant('errorFallbacksA.setupFailed');
        if (err.status >= 500 || err.status === 0) {
          this.toast.show({ severity: 'error', title: this.translate.instant('auth.setupFailedTitle'), message: detail });
        } else if (err.status === 400) {
          const applied = FormValidationService.applyServerError(this.form, err);
          if (!applied || applied.unmatched.length > 0) this.submitError.set(detail);
        } else {
          this.error.set(detail);
        }
      },
    });
  }
}
