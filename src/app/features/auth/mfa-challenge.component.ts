import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationButtonComponent } from '../../shared/components/validation-button/validation-button.component';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { MfaService } from '../account/services/mfa.service';
import { MfaChallengeResponse, MfaValidateResponse } from '../account/models/mfa.model';

const MAX_FAILED_ATTEMPTS = 5;
const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;

@Component({
  selector: 'app-mfa-challenge',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent, ValidationButtonComponent],
  templateUrl: './mfa-challenge.component.html',
  styleUrl: './mfa-challenge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaChallengeComponent implements OnInit {
  private readonly mfaService = inject(MfaService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly pendingToken = input.required<string>();
  readonly allowRememberDevice = input(true);
  readonly validated = output<MfaValidateResponse>();
  readonly cancelled = output<void>();

  protected readonly loading = signal(true);
  protected readonly verifying = signal(false);
  protected readonly challenge = signal<MfaChallengeResponse | null>(null);
  protected readonly showRecovery = signal(false);
  protected readonly error = signal<string | null>(null);
  private failedAttempts = 0;
  private challengeIssuedAt = 0;

  protected readonly codeForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6}$/)] }),
    rememberDevice: new FormControl(false, { nonNullable: true }),
  });

  protected readonly recoveryForm = new FormGroup({
    recoveryCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly codeViolations = FormValidationService.getViolations(this.codeForm, {
    code: this.translate.instant('account.mfa.verificationCode'),
  });

  protected readonly recoveryViolations = FormValidationService.getViolations(this.recoveryForm, {
    recoveryCode: this.translate.instant('auth.mfa.recoveryCode'),
  });

  ngOnInit(): void {
    this.mfaService.createChallenge(this.pendingToken()).subscribe({
      next: (challenge) => {
        this.challenge.set(challenge);
        this.challengeIssuedAt = Date.now();
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.snackbar.errorFrom(err, 'errorFallbacksA.mfaChallengeFailed');
        this.cancelled.emit();
      },
    });
  }

  protected submitCode(): void {
    if (this.codeForm.invalid || this.verifying()) return;
    const ch = this.challenge();
    if (!ch) return;

    this.verifying.set(true);
    this.error.set(null);

    this.mfaService.validateChallenge({
      challengeToken: ch.challengeToken,
      code: this.codeForm.getRawValue().code,
      rememberDevice: this.allowRememberDevice() && this.codeForm.getRawValue().rememberDevice,
    }).subscribe({
      next: (result) => {
        this.verifying.set(false);
        this.validated.emit(result);
      },
      error: (err: unknown) => {
        this.verifying.set(false);
        this.onVerifyFailed(err, 'auth.mfa.invalidCode', () => this.codeForm.controls.code.reset());
      },
    });
  }

  protected submitRecovery(): void {
    if (this.recoveryForm.invalid || this.verifying()) return;
    const ch = this.challenge();
    if (!ch) return;

    this.verifying.set(true);
    this.error.set(null);

    this.mfaService.validateRecovery(
      ch.challengeToken,
      this.recoveryForm.getRawValue().recoveryCode,
    ).subscribe({
      next: (result) => {
        this.verifying.set(false);
        this.validated.emit(result);
      },
      error: (err: unknown) => {
        this.verifying.set(false);
        this.onVerifyFailed(err, 'auth.mfa.invalidRecoveryCode', () => this.recoveryForm.controls.recoveryCode.reset());
      },
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  private onVerifyFailed(err: unknown, invalidKey: string, resetField: () => void): void {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const expired = status === 404 || status === 410
      || (status === 401 && Date.now() - this.challengeIssuedAt > CHALLENGE_LIFETIME_MS);

    if (expired) {
      this.snackbar.error(this.translate.instant('auth.mfa.challengeExpired'));
      this.cancelled.emit();
      return;
    }
    if (status === 429) {
      this.error.set(this.translate.instant('auth.mfa.tooManyAttempts'));
      return;
    }
    if (status === 400 || status === 401) {
      this.failedAttempts++;
      this.error.set(this.translate.instant(
        this.failedAttempts >= MAX_FAILED_ATTEMPTS ? 'auth.mfa.tooManyAttempts' : invalidKey));
      resetField();
      return;
    }
    this.snackbar.errorFrom(err, 'auth.mfa.verifyFailed');
  }
}
