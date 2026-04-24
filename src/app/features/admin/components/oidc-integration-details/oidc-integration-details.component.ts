import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';

/**
 * Drop-in card that renders everything an external OIDC client needs to be configured to talk
 * to qb-engineer: issuer URL, discovery URL, each endpoint, scope list, and a ready-to-paste
 * JSON config block. Consumed from both the "provision client" dialog (where credentials are
 * briefly visible) and the per-client detail view (where they aren't).
 *
 * The component is deliberately read-only — copy buttons + display. No HTTP calls; every value
 * is passed in as an input so the component stays predictable and testable.
 */
@Component({
  selector: 'app-oidc-integration-details',
  standalone: true,
  imports: [],
  templateUrl: './oidc-integration-details.component.html',
  styleUrl: './oidc-integration-details.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcIntegrationDetailsComponent {
  private readonly snackbar = inject(SnackbarService);

  readonly clientId = input.required<string>();
  readonly scopes = input<string[]>([]);
  readonly publicBaseUrl = input<string>('');
  /** Client's configured redirect URIs — used in the sample config blob. */
  readonly redirectUris = input<string[]>([]);
  /** Optional — only shown when the secret is still in memory (fresh provisioning / rotation). */
  readonly clientSecret = input<string | null>(null);

  /** Effective issuer; falls back to the browser origin when publicBaseUrl isn't configured. */
  protected readonly issuer = computed(() => {
    const configured = (this.publicBaseUrl() || '').trim().replace(/\/$/, '');
    return configured || window.location.origin;
  });

  protected readonly endpoints = computed(() => {
    const base = this.issuer();
    return {
      discovery: `${base}/.well-known/openid-configuration`,
      authorize: `${base}/connect/authorize`,
      token: `${base}/connect/token`,
      userinfo: `${base}/connect/userinfo`,
      endSession: `${base}/connect/logout`,
      jwks: `${base}/.well-known/jwks`,
      registration: `${base}/connect/register`,
    };
  });

  protected readonly scopeString = computed(() => (this.scopes() ?? []).join(' '));

  /** JSON blob a developer can paste directly into an OIDC client library config. */
  protected readonly configBlob = computed(() => {
    const sec = this.clientSecret();
    const payload: Record<string, unknown> = {
      issuer: this.issuer(),
      authority: this.issuer(),
      client_id: this.clientId(),
      ...(sec ? { client_secret: sec } : {}),
      redirect_uri: this.redirectUris()[0] ?? '',
      response_type: 'code',
      scope: this.scopeString(),
      grant_types: ['authorization_code', 'refresh_token'],
    };
    return JSON.stringify(payload, null, 2);
  });

  protected copy(value: string, label: string): void {
    navigator.clipboard.writeText(value).then(
      () => this.snackbar.success(`${label} copied`),
      () => this.snackbar.error(`Could not copy ${label.toLowerCase()}`),
    );
  }

  protected copyDiscovery(): void { this.copy(this.endpoints().discovery, 'Discovery URL'); }
  protected copyIssuer(): void { this.copy(this.issuer(), 'Issuer URL'); }
  protected copyClientId(): void { this.copy(this.clientId(), 'Client ID'); }
  protected copySecret(): void {
    const s = this.clientSecret();
    if (s) this.copy(s, 'Client secret');
  }
  protected copyConfigBlob(): void { this.copy(this.configBlob(), 'Config JSON'); }
}
