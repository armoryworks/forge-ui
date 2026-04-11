import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../shared/services/auth.service';
import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { LayoutService } from '../../shared/services/layout.service';
import { LoadingService } from '../../shared/services/loading.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { SsoProvider } from '../../shared/models/sso-provider.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatCardModule, MatButtonModule, MatDividerModule, TranslatePipe, InputComponent, ValidationPopoverDirective],
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

  ngOnInit(): void {
    // Show session expired message if redirected after token invalidation
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason === 'session_expired') {
      this.snackbar.info(this.translate.instant('auth.sessionExpired'));
      // Clean the query param from URL without triggering navigation
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
    this.router.navigate([this.layout.getDefaultRoute()]);
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
    if (this.form.invalid) return;

    const { email, password } = this.form.getRawValue();

    this.loadingService.track(this.translate.instant('auth.signingIn'), this.authService.login({ email: email!, password: password! }))
      .subscribe({
        next: (response) => {
          this.router.navigate([response.user.profileComplete ? this.layout.getDefaultRoute() : '/account/profile']);
        },
        error: (err: HttpErrorResponse) => this.handleError(err),
      });
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
