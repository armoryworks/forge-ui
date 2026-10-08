import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService, AuthUser } from '../../shared/services/auth.service';
import { BrandingService } from '../../shared/services/branding.service';
import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { LayoutService } from '../../shared/services/layout.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { SsoProvider } from '../../shared/models/sso-provider.model';
import { MfaChallengeComponent } from './mfa-challenge.component';
import { MfaValidateResponse } from '../account/models/mfa.model';
import { needsProfileCompletion } from './post-login.utils';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatDividerModule, TranslatePipe, InputComponent, ValidationButtonComponent, MfaChallengeComponent],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly layout = inject(LayoutService);
  private readonly loadingService = inject(LoadingService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly branding = inject(BrandingService);

  protected readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required]),
  });

  protected readonly violations = FormValidationService.getViolations(this.form, {
    email: 'Email',
    password: 'Password',
  });

  protected readonly loading = this.loadingService.isLoading;
  protected readonly isAlreadyLoggedIn = computed(() => this.authService.isAuthenticated());
  protected readonly currentUser = this.authService.user;
  protected readonly ssoProviders = signal<SsoProvider[]>([]);
  protected readonly showSetupCode = signal(false);
  protected readonly setupCodeControl = new FormControl('');
  protected readonly mfaRequired = signal(false);
  protected readonly mfaPendingToken = signal<string | null>(null);

  /** Intended destination captured from the auth guard redirect. */
  private returnUrl: string | null = null;

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    // Show session expired message if redirected after token invalidation
    const reason = params.get('reason');
    if (reason === 'session_expired') {
      this.snackbar.info(this.translate.instant('auth.sessionExpired'));
    }

    // Capture return URL from auth guard
    this.returnUrl = params.get('returnUrl');

    // Clean query params from URL without triggering navigation
    if (reason || this.returnUrl) {
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }

    // Load available SSO providers
    this.authService.getSsoProviders().subscribe(providers => {
      this.ssoProviders.set(providers);
    });
  }

  protected ssoLogin(provider: SsoProvider): void {
    this.authService.ssoLogin(provider.id);
  }

  protected getSsoIcon(providerId: string): string {
    switch (providerId) {
      case 'google': return 'g_mobiledata';
      case 'microsoft': return 'window';
      default: return 'key';
    }
  }

  protected goToDashboard(): void {
    this.navigatePostLogin(null);
  }

  protected switchAccount(): void {
    this.authService.logout();
  }

  protected goToSetup(): void {
    const code = this.setupCodeControl.value?.trim();
    if (code) {
      this.router.navigate(['/setup', code]);
    }
  }

  protected onSubmit(): void {
    if (this.loading()) return;
    this.syncAutofilledValues();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.loadingService.track(this.translate.instant('auth.signingIn'), this.authService.login({ email: email!, password: password! }))
      .subscribe({
        next: (response) => {
          if (response.mfaRequired && response.mfaPendingToken) {
            this.mfaRequired.set(true);
            this.mfaPendingToken.set(response.mfaPendingToken);
            return;
          }
          // Defensive: a non-MFA success always carries a user, but never crash the
          // login flow (and silently stall) if the server omits it.
          this.navigatePostLogin(response.user);
        },
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
  }

  protected onMfaValidated(result: MfaValidateResponse): void {
    this.mfaRequired.set(false);
    this.mfaPendingToken.set(null);
    // Set the token + load the user, THEN navigate — a single coordinated flow
    // (no redundant token refresh) so the dashboard doesn't bootstrap before the
    // session is fully in place.
    this.authService.completeMfaLogin(result.accessToken, result.trustedDeviceToken).subscribe({
      next: (user) => {
        this.navigatePostLogin(user);
      },
      error: () => {
        // Token is valid, just navigate to dashboard
        this.router.navigate([this.layout.getDefaultRoute()]);
      },
    });
  }

  protected onMfaCancelled(): void {
    this.mfaRequired.set(false);
    this.mfaPendingToken.set(null);
  }

  private syncAutofilledValues(): void {
    const fields = [['email', 'login-email'], ['password', 'login-password']] as const;
    for (const [name, testId] of fields) {
      const input = this.host.nativeElement.querySelector<HTMLInputElement>(`[data-testid="${testId}"] input`);
      const control = this.form.controls[name];
      if (input && input.value && input.value !== control.value) {
        control.setValue(input.value);
      }
    }
  }

  private navigatePostLogin(user: AuthUser | null | undefined): void {
    if (needsProfileCompletion(user, window.innerWidth)) {
      this.router.navigate(['/account/profile']);
      return;
    }
    if (this.returnUrl) {
      this.router.navigateByUrl(this.returnUrl);
      return;
    }
    this.router.navigate([this.layout.getDefaultRoute()]);
  }

  private handleError(err: HttpErrorResponse): void {
    if (err.status === 401) {
      this.snackbar.error(this.translate.instant('auth.loginFailed'));
    } else if (err.status >= 500 || err.error?.stackTrace || err.error?.traceId) {
      this.toast.show({
        severity: 'error',
        title: this.translate.instant('auth.loginFailed'),
        message: err.error?.detail ?? this.translate.instant('errors.serverError'),
        details: err.error?.stackTrace ?? `Status ${err.status}: ${err.statusText}`,
      });
    } else {
      this.snackbar.error(err.error?.detail ?? 'Unable to connect to server.');
    }
  }
}
