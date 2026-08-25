import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { map } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { LanguageToggleComponent } from '../../../shared/components/language-toggle/language-toggle.component';
import { ValidationButtonComponent } from '../../../shared/components/validation-button/validation-button.component';
import { ForgeWellKnown } from '../../../shared/models/mobile-auth.model';
import { LoginResponse } from '../../../shared/services/auth.service';
import { FormValidationService } from '../../../shared/services/form-validation.service';
import { MobileAuthService } from '../../../shared/services/mobile-auth.service';

type ManualStep = 'address' | 'trust' | 'login' | 'totp';

interface MfaChallengeResponse {
  challengeToken: string;
  deviceType: string;
  maskedTarget: string | null;
}

interface MfaValidateResponse {
  accessToken: string;
}

/**
 * Manual enrollment: type the server address, trust its certificate
 * fingerprint (TOFU), sign in with the instance's allowed methods (TOTP
 * challenge honored), and enroll this device. The only typing the app
 * permits outside a PIN pad.
 */
@Component({
  selector: 'app-enroll-manual',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, InputComponent, ValidationButtonComponent, LanguageToggleComponent],
  templateUrl: './enroll-manual.component.html',
  styleUrl: './enroll-manual.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollManualComponent {
  private readonly http = inject(HttpClient);
  private readonly mobileAuth = inject(MobileAuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);

  protected readonly step = toSignal(
    this.route.queryParamMap.pipe(map((p) => (p.get('step') ?? 'address') as ManualStep)),
    { initialValue: 'address' as ManualStep },
  );

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly wellKnown = signal<ForgeWellKnown | null>(null);
  protected readonly origin = signal<string | null>(null);
  private readonly mfaPendingToken = signal<string | null>(null);
  private readonly challengeToken = signal<string | null>(null);

  protected readonly addressForm = new FormGroup({
    server: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly loginForm = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly totpForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });

  protected readonly addressViolations = FormValidationService.getViolations(this.addressForm, {
    server: this.translate.instant('mobileApp.enroll.serverAddress'),
  });

  protected readonly loginViolations = FormValidationService.getViolations(this.loginForm, {
    email: this.translate.instant('mobileApp.enroll.email'),
    password: this.translate.instant('mobileApp.enroll.password'),
  });

  protected readonly totpViolations = FormValidationService.getViolations(this.totpForm, {
    code: this.translate.instant('mobileApp.enroll.totpCode'),
  });

  protected readonly fingerprintDisplay = computed(() => {
    const cert = this.wellKnown()?.cert_sha256;
    if (!cert) return null;
    return `${cert.slice(0, 4).toUpperCase()}…${cert.slice(-4).toUpperCase()}`;
  });

  constructor() {
    // A refresh mid-flow loses the transient discovery state — restart at
    // the address step rather than presenting a trust screen with no data.
    effect(() => {
      if (this.step() !== 'address' && !this.wellKnown()) {
        this.goTo('address');
      }
    });
  }

  protected discover(): void {
    if (this.addressForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    let origin: string;
    try {
      origin = MobileAuthService.normalizeOrigin(this.addressForm.controls.server.value);
    } catch {
      this.busy.set(false);
      this.error.set(this.translate.instant('mobileApp.enroll.httpsRequired'));
      return;
    }

    this.mobileAuth.discover(origin).subscribe({
      next: (wellKnown) => {
        this.busy.set(false);
        this.origin.set(origin);
        this.wellKnown.set(wellKnown);
        this.goTo('trust');
      },
      error: () => {
        this.busy.set(false);
        this.error.set(this.translate.instant('mobileApp.enroll.discoveryFailed'));
      },
    });
  }

  protected trust(): void {
    this.goTo('login');
  }

  protected login(): void {
    if (this.loginForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    this.http.post<LoginResponse>(`${this.origin()}/api/v1/auth/login`, {
      email: this.loginForm.controls.email.value,
      password: this.loginForm.controls.password.value,
    }).subscribe({
      next: (response) => {
        if (response.mfaRequired && response.mfaPendingToken) {
          this.mfaPendingToken.set(response.mfaPendingToken);
          this.beginTotpChallenge();
          return;
        }
        this.enroll(response.token);
      },
      error: () => {
        this.busy.set(false);
        this.error.set(this.translate.instant('mobileApp.enroll.loginFailed'));
      },
    });
  }

  protected validateTotp(): void {
    if (this.totpForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);

    this.http.post<MfaValidateResponse>(`${this.origin()}/api/v1/auth/mfa/validate`, {
      challengeToken: this.challengeToken(),
      code: this.totpForm.controls.code.value,
      rememberDevice: false,
    }).subscribe({
      next: (response) => this.enroll(response.accessToken),
      error: () => {
        this.busy.set(false);
        this.error.set(this.translate.instant('mobileApp.enroll.totpFailed'));
      },
    });
  }

  private beginTotpChallenge(): void {
    this.http.post<MfaChallengeResponse>(`${this.origin()}/api/v1/auth/mfa/challenge`, {
      mfaPendingToken: this.mfaPendingToken(),
    }).subscribe({
      next: (challenge) => {
        this.busy.set(false);
        this.challengeToken.set(challenge.challengeToken);
        this.goTo('totp');
      },
      error: () => {
        this.busy.set(false);
        this.error.set(this.translate.instant('mobileApp.enroll.loginFailed'));
      },
    });
  }

  private enroll(accessToken: string): void {
    const wellKnown = this.wellKnown()!;
    this.mobileAuth.enrollAuthenticated(
      this.origin()!, wellKnown.name, wellKnown.cert_sha256, accessToken,
    ).subscribe({
      next: () => this.router.navigate(['/app/scan']),
      error: () => {
        this.busy.set(false);
        this.error.set(this.translate.instant('mobileApp.enroll.enrollFailed'));
      },
    });
  }

  private goTo(step: ManualStep): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { step },
      queryParamsHandling: 'merge',
    });
  }
}
