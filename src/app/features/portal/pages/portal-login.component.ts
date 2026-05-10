import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { InputComponent } from '../../../shared/components/input/input.component';
import { PortalService } from '../services/portal.service';

/**
 * Portal magic-link request page. Submitting the form fires a passwordless
 * sign-in: the API generates a one-time token, emails the link, and
 * (in dev / no-SMTP installs) returns the link in the response so the
 * developer can complete the round-trip without a mailbox.
 */
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
  protected readonly translate = inject(TranslateService);

  protected readonly emailControl = new FormControl<string>('', { nonNullable: true, validators: [Validators.required, Validators.email] });
  protected readonly submitting = signal(false);
  protected readonly submitted = signal(false);
  protected readonly devLink = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  protected submit(): void {
    if (this.emailControl.invalid) return;
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.devLink.set(null);

    this.portal.requestMagicLink(this.emailControl.value).subscribe({
      next: (result) => {
        this.submitted.set(true);
        this.submitting.set(false);
        this.devLink.set(result.devLink);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.errors?.[0]?.message
          ?? this.translate.instant('portal.login.error'));
      },
    });
  }

  protected followDevLink(): void {
    const link = this.devLink();
    if (!link) return;
    // Strip the host part — the link points at this same UI but we want to
    // navigate via the router rather than trigger a full page reload.
    const url = new URL(link);
    this.router.navigateByUrl(url.pathname + url.search);
  }
}
