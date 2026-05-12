import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { CommunicationsService } from '../../services/communications.service';

/**
 * Wave 8 phase 1k.2 — OAuth-IMAP redirect-back page. The route lives at
 * <c>/account/communications/oauth-callback</c> — registered with both
 * Google and Microsoft as the authorized redirect URI. The provider
 * appends <c>code</c> and <c>state</c> as query params on the redirect;
 * we POST them to <c>/oauth/imap/{provider}/complete</c> and bounce back
 * to the connections list.
 *
 * Provider-key discovery: the begin-flow stashed it in sessionStorage so
 * we know which /complete endpoint to call (the code/state alone don't
 * tell us). If sessionStorage is empty (user closed the tab between
 * begin and callback), we treat it as an abandoned flow and show a
 * friendly error.
 */
@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="oauth-cb">
      <div class="oauth-cb__icon-wrap">
        <span class="material-icons-outlined oauth-cb__icon"
          [class.oauth-cb__icon--spin]="status() === 'pending'"
          [class.oauth-cb__icon--success]="status() === 'success'"
          [class.oauth-cb__icon--error]="status() === 'error'">
          {{ statusIcon() }}
        </span>
      </div>
      <h2 class="oauth-cb__title">{{ statusTitle() | translate }}</h2>
      <p class="oauth-cb__message">{{ statusMessage() }}</p>
    </div>
  `,
  styles: [`
    @use 'styles/variables' as *;
    :host {
      display: flex; align-items: center; justify-content: center;
      min-height: calc(100vh - $header-height);
      padding: $sp-2xl;
    }
    .oauth-cb {
      max-width: 420px;
      text-align: center;
      &__icon-wrap { margin-bottom: $sp-lg; }
      &__icon {
        font-size: 48px;
        color: var(--text-muted);
        &--spin { animation: spin 1.2s linear infinite; }
        &--success { color: var(--success); }
        &--error { color: var(--error); }
      }
      &__title { font-size: $font-size-lg; font-weight: 600; margin: 0 0 $sp-sm; }
      &__message { font-size: $font-size-sm; color: var(--text-muted); margin: 0; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OauthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(CommunicationsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly toast = inject(ToastService);
  private readonly translate = inject(TranslateService);

  protected readonly status = signal<'pending' | 'success' | 'error'>('pending');
  protected readonly statusMessage = signal<string>(
    this.translate.instant('account.communications.oauth.callbackPending'),
  );

  protected statusIcon(): string {
    return this.status() === 'pending' ? 'sync'
      : this.status() === 'success' ? 'check_circle' : 'error_outline';
  }

  protected statusTitle(): string {
    return this.status() === 'pending'
      ? 'account.communications.oauth.callbackPendingTitle'
      : this.status() === 'success'
        ? 'account.communications.oauth.callbackSuccessTitle'
        : 'account.communications.oauth.callbackErrorTitle';
  }

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state');
    const providerError = this.route.snapshot.queryParamMap.get('error');
    const provider = sessionStorage.getItem('forge-oauth-imap-provider') as 'google' | 'microsoft' | null;
    sessionStorage.removeItem('forge-oauth-imap-provider');

    if (providerError) {
      this.fail(this.translate.instant('account.communications.oauth.providerDeclined', {
        error: providerError,
      }));
      return;
    }

    if (!code || !state) {
      this.fail(this.translate.instant('account.communications.oauth.callbackMissingParams'));
      return;
    }
    if (!provider) {
      this.fail(this.translate.instant('account.communications.oauth.callbackProviderUnknown'));
      return;
    }

    this.service.completeOAuthImap(provider, code, state).subscribe({
      next: () => {
        this.status.set('success');
        this.statusMessage.set(this.translate.instant('account.communications.oauth.callbackSuccess'));
        this.snackbar.success(this.translate.instant('account.communications.oauth.callbackSuccessSnackbar'));
        // Brief pause so the user sees the success state, then bounce back.
        setTimeout(() => this.router.navigate(['/account/communications']), 1200);
      },
      error: (err) => {
        const detail = (err.error?.detail as string | undefined)
          ?? this.translate.instant('account.communications.oauth.callbackFailed');
        this.toast.show({
          severity: 'error',
          title: this.translate.instant('account.communications.oauth.callbackErrorTitle'),
          message: detail,
        });
        this.fail(detail);
      },
    });
  }

  private fail(message: string): void {
    this.status.set('error');
    this.statusMessage.set(message);
  }
}
