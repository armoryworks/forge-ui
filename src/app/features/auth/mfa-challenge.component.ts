import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormControl, FormGroup, Validators } from '@angular/forms';

import { InputComponent } from '../../shared/components/input/input.component';
import { ValidationPopoverDirective } from '../../shared/directives/validation-popover.directive';
import { FormValidationService } from '../../shared/services/form-validation.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { MfaService } from '../account/services/mfa.service';
import { MfaChallengeResponse, MfaValidateResponse } from '../account/models/mfa.model';

@Component({
  selector: 'app-mfa-challenge',
  standalone: true,
  imports: [ReactiveFormsModule, InputComponent, ValidationPopoverDirective],
  templateUrl: './mfa-challenge.component.html',
  styleUrl: './mfa-challenge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfaChallengeComponent implements OnInit {
  private readonly mfaService = inject(MfaService);
  private readonly snackbar = inject(SnackbarService);

  readonly userId = input.required<number>();
  readonly validated = output<MfaValidateResponse>();
  readonly cancelled = output<void>();

  protected readonly loading = signal(true);
  protected readonly verifying = signal(false);
  protected readonly challenge = signal<MfaChallengeResponse | null>(null);
  protected readonly showRecovery = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly codeForm = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^\d{6}$/)] }),
    rememberDevice: new FormControl(false, { nonNullable: true }),
  });

  protected readonly recoveryForm = new FormGroup({
    recoveryCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly codeViolations = FormValidationService.getViolations(this.codeForm, {
    code: 'Verification Code',
  });

  ngOnInit(): void {
    this.mfaService.createChallenge(this.userId()).subscribe({
      next: (challenge) => {
        this.challenge.set(challenge);
        this.loading.set(false);
      },
      error: () => {
        this.snackbar.error('Failed to create MFA challenge');
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
      rememberDevice: this.codeForm.getRawValue().rememberDevice,
    }).subscribe({
      next: (result) => {
        this.verifying.set(false);
        this.validated.emit(result);
      },
      error: () => {
        this.verifying.set(false);
        this.error.set('Invalid verification code');
        this.codeForm.controls.code.reset();
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
      error: () => {
        this.verifying.set(false);
        this.error.set('Invalid recovery code');
        this.recoveryForm.controls.recoveryCode.reset();
      },
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }
}
