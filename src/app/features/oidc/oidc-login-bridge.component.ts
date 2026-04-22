import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';
import { OidcConsentService } from './services/oidc-consent.service';

@Component({
  selector: 'app-oidc-login-bridge',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './oidc-login-bridge.component.html',
  styleUrl: './oidc-login-bridge.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OidcLoginBridgeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly consent = inject(OidcConsentService);

  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('ReturnUrl')
      ?? this.route.snapshot.queryParamMap.get('returnUrl')
      ?? this.route.snapshot.queryParamMap.get('return_url');

    if (!returnUrl) {
      this.error.set('Missing return URL.');
      return;
    }

    if (!this.auth.isAuthenticated()) {
      const target = `/login?returnUrl=${encodeURIComponent(`/oidc/login?ReturnUrl=${encodeURIComponent(returnUrl)}`)}`;
      this.router.navigateByUrl(target);
      return;
    }

    this.consent.interactiveLogin().subscribe({
      next: () => {
        window.location.assign(returnUrl);
      },
      error: err => {
        this.error.set(err.error?.error ?? 'Unable to establish an OIDC session.');
      },
    });
  }
}
