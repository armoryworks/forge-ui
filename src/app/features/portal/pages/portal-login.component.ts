import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval, take } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { PortalService } from '../services/portal.service';

/**
 * Portal magic-link request page. Submitting the form fires a passwordless
 * sign-in: the API generates a one-time token, emails the link, and
 * (in dev / no-SMTP installs) returns the link in the response so the
 * developer can complete the round-trip without a mailbox. "Send again"
 * stays disabled for the API's resend cooldown, which would otherwise
 * drop the extra request without sending mail.
 */
const RESEND_COOLDOWN_SECONDS = 60;

@Component({
  selector: 'app-portal-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './portal-login.component.html',
  styleUrl: './portal-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalLoginComponent {
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly translate = inject(TranslateService);

  protected readonly emailControl = new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly devLink = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly resendIn = signal(0);
  protected readonly sessionExpired = signal(
    inject(ActivatedRoute).snapshot.queryParamMap.get('reason') === 'session_expired',
  );
  private cooldown: Subscription | null = null;

  protected submit(): void {
    if (this.submitting() || this.emailControl.invalid) return;
    const email = this.emailControl.value;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.devLink.set(null);
    this.emailControl.disable();

    this.portal.requestMagicLink(email).subscribe({
      next: (result) => {
        this.submitted.set(true);
        this.submitting.set(false);
        this.emailControl.enable();
        this.devLink.set(result.devLink);
        this.startCooldown();
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitted.set(false);
        this.emailControl.enable();
        this.errorMessage.set(err?.error?.errors?.[0]?.message
          ?? this.translate.instant('portal.login.error'));
      },
    });
  }

  protected useDifferentEmail(): void {
    this.submitted.set(false);
    this.devLink.set(null);
    this.errorMessage.set(null);
  }

  protected followDevLink(): void {
    const link = this.devLink();
    if (!link) return;
    // Strip the host part — the link points at this same UI but we want to
    // navigate via the router rather than trigger a full page reload.
    const url = new URL(link);
    this.router.navigateByUrl(url.pathname + url.search);
  }

  private startCooldown(): void {
    this.cooldown?.unsubscribe();
    this.resendIn.set(RESEND_COOLDOWN_SECONDS);
    this.cooldown = interval(1000)
      .pipe(take(RESEND_COOLDOWN_SECONDS), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.resendIn.update(s => Math.max(0, s - 1)));
  }
}
