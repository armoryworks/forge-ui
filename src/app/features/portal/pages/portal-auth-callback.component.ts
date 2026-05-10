import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PortalService } from '../services/portal.service';

/**
 * Portal magic-link callback. Reads `?token=...` from the URL, exchanges
 * it for a session token, then navigates to the dashboard. On failure
 * (expired / already-used / unknown) shows a clear error and a link
 * back to the login page so the user can request a fresh one.
 */
@Component({
  selector: 'app-portal-auth-callback',
  standalone: true,
  imports: [TranslatePipe, RouterLink],
  templateUrl: './portal-auth-callback.component.html',
  styleUrl: './portal-auth-callback.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortalAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly portal = inject(PortalService);
  protected readonly translate = inject(TranslateService);

  protected readonly status = signal<'pending' | 'failed'>('pending');
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.status.set('failed');
      this.errorMessage.set(this.translate.instant('portal.callback.missing'));
      return;
    }

    this.portal.exchangeMagicLink(token).subscribe({
      next: () => this.router.navigate(['/portal/dashboard']),
      error: (err) => {
        this.status.set('failed');
        this.errorMessage.set(err?.error?.errors?.[0]?.message
          ?? this.translate.instant('portal.callback.failed'));
      },
    });
  }
}
