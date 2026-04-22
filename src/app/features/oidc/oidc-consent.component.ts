import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { ToastService } from '../../shared/services/toast.service';
import { OidcConsentService } from './services/oidc-consent.service';
import { ConsentContextResponse } from './models/consent-context.model';

@Component({
  selector: 'app-oidc-consent',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatDividerModule],
  templateUrl: './oidc-consent.component.html',
  styleUrl: './oidc-consent.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcConsentComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly consent = inject(OidcConsentService);
  private readonly auth = inject(AuthService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly context = signal<ConsentContextResponse | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly clientLabel = computed(() =>
    this.context()?.clientDisplayName ?? this.context()?.clientId ?? '');
  protected readonly currentUserEmail = computed(() => this.auth.user()?.email ?? '');

  private clientId = '';
  private scope = '';
  private returnUrl = '';

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap;
    this.clientId = q.get('client_id') ?? '';
    this.scope = q.get('scope') ?? '';
    this.returnUrl = q.get('return_url') ?? '';

    if (!this.clientId || !this.returnUrl) {
      this.error.set('This consent request is missing required parameters.');
      this.loading.set(false);
      return;
    }

    this.consent.getContext(this.clientId, this.scope).subscribe({
      next: ctx => {
        this.context.set(ctx);
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.error?.error ?? 'Unable to load consent information.');
        this.loading.set(false);
      },
    });
  }

  protected allow(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    const scopes = this.scopeList();
    this.consent.grant(this.clientId, scopes).subscribe({
      next: () => {
        window.location.assign(this.returnUrl);
      },
      error: err => {
        this.submitting.set(false);
        this.toast.show({
          severity: 'error',
          title: 'Consent failed',
          message: err.error?.error ?? 'Unable to record your consent.',
        });
      },
    });
  }

  protected deny(): void {
    if (this.submitting()) return;
    this.submitting.set(true);
    const scopes = this.scopeList();
    this.consent.deny(this.clientId, scopes).subscribe({
      next: () => {
        this.snackbar.info('Access declined.');
        this.redirectWithError();
      },
      error: () => {
        this.redirectWithError();
      },
    });
  }

  protected async switchAccount(): Promise<void> {
    const target = `/login?returnUrl=${encodeURIComponent(this.router.url)}`;
    await this.auth.logout();
    this.router.navigateByUrl(target);
  }

  private scopeList(): string[] {
    return this.scope.split(' ').filter(s => s.length > 0);
  }

  private redirectWithError(): void {
    const url = new URL(this.returnUrl, window.location.origin);
    url.searchParams.set('error', 'access_denied');
    url.searchParams.set('error_description', 'The user declined to authorize the application.');
    window.location.assign(url.toString());
  }
}
