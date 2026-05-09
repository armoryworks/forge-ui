import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import {
  CommunicationProviderInfo,
  CommunicationSyncConfigSummary,
} from '../../models/communication-sync.model';
import { CommunicationsService } from '../../services/communications.service';
import {
  ConnectCommunicationDialogComponent,
  ConnectCommunicationDialogData,
} from './connect-communication-dialog.component';
import { ConnectImapDialogComponent } from './connect-imap-dialog.component';

interface KindGroup {
  kind: 'Email' | 'Voice';
  labelKey: string;
  icon: string;
  capability: string;
  capabilityEnabled: boolean;
  connected: CommunicationSyncConfigSummary[];
  available: CommunicationProviderInfo[];
}

/**
 * Wave 8 — Communication tracking surface. Lets a salesperson connect
 * their work mailbox / phone so the matcher can auto-log inbound and
 * outbound traffic against active leads / customer contacts.
 *
 * Layout mirrors the existing Integrations page: per-Kind groups (Email,
 * Voice) showing the user's connected rows on top and the available
 * provider tiles below. Capability gating is per-kind — when
 * CAP-EXT-EMAIL-SYNC or CAP-EXT-VOIP-SYNC is disabled, the corresponding
 * group hides its available list and adds a banner explaining the gate.
 */
@Component({
  selector: 'app-account-communications',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './account-communications.component.html',
  styleUrl: './account-communications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountCommunicationsComponent implements OnInit {
  private readonly service = inject(CommunicationsService);
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly loading = this.service.loading;
  protected readonly syncing = this.service.syncing;

  /**
   * Phase 1k.1 — aggregate health for the current user's connections.
   * Surfaces above the kind groups so a salesperson lands on the page
   * and immediately sees "1 broken / 2 healthy / 0 pending" rather than
   * having to read each card.
   */
  protected readonly health = computed(() => {
    const all = this.service.connections();
    return {
      total: all.length,
      connected: all.filter(c => c.isConnected && !c.lastError).length,
      pending: all.filter(c => !c.isConnected).length,
      errored: all.filter(c => !!c.lastError).length,
      neverSynced: all.filter(c => c.isConnected && c.lastSyncedAt === null).length,
    };
  });

  protected readonly kindGroups = computed<KindGroup[]>(() => {
    const connections = this.service.connections();
    const providers = this.service.providers;

    const groups: { kind: 'Email' | 'Voice'; labelKey: string; icon: string; capability: string }[] = [
      { kind: 'Email', labelKey: 'account.communications.kindEmail', icon: 'mail', capability: 'CAP-EXT-EMAIL-SYNC' },
      { kind: 'Voice', labelKey: 'account.communications.kindVoice', icon: 'phone', capability: 'CAP-EXT-VOIP-SYNC' },
    ];

    return groups.map(g => {
      const connected = connections.filter(c => c.kind === g.kind);
      const available = providers
        .filter(p => p.kind === g.kind)
        // Hide a provider tile when the user already has *any* connection
        // for it — most users only want one mailbox per provider; the
        // "two Gmail accounts" case still works via the "add another"
        // affordance on the connected card (future).
        .filter(p => !connected.some(c => c.providerId === p.providerId));

      return {
        ...g,
        capabilityEnabled: this.capabilities.isEnabled(g.capability),
        connected,
        available,
      };
    });
  });

  ngOnInit(): void {
    this.service.loadConnections();
  }

  protected connectProvider(provider: CommunicationProviderInfo): void {
    // IMAP gets its own dialog with preset picker + host/port/creds. The
    // generic dialog would let the user persist a row whose ConfigJson
    // doesn't match what ImapEmailSyncProvider expects, then sync would
    // fail every Hangfire tick. Better to enforce the shape at connect.
    if (provider.providerId === 'imap') {
      this.dialog.open(ConnectImapDialogComponent, { width: '520px' });
      return;
    }

    // Phase 1k.2 — Gmail / Microsoft via OAuth. Server returns the
    // authorize URL; we navigate same-tab to it. The provider redirects
    // to /account/communications/oauth-callback which exchanges code+state
    // and bounces back to /account/communications.
    if (provider.providerId === 'gmail-oauth' || provider.providerId === 'microsoft-oauth') {
      const providerKey = provider.providerId === 'gmail-oauth' ? 'google' : 'microsoft';
      this.service.beginOAuthImap(providerKey).subscribe({
        next: (result) => {
          // Persist provider-key for the callback page to know which
          // /complete endpoint to POST to (state alone doesn't tell us).
          sessionStorage.setItem('qbe-oauth-imap-provider', providerKey);
          window.location.href = result.authorizeUrl;
        },
        error: () => {
          // HttpErrorInterceptor already toasts; nothing else to do.
        },
      });
      return;
    }

    this.dialog.open(ConnectCommunicationDialogComponent, {
      width: '480px',
      data: { provider } satisfies ConnectCommunicationDialogData,
    });
  }

  protected syncNow(connection: CommunicationSyncConfigSummary): void {
    if (this.syncing().has(connection.id)) return;
    this.service.syncNow(connection.id).subscribe({
      next: (result) => {
        this.snackbar.success(this.translate.instant('account.communications.syncCompleted', {
          count: result.eventCount,
        }));
      },
    });
  }

  protected disconnect(connection: CommunicationSyncConfigSummary): void {
    const provider = this.service.providers.find(p => p.providerId === connection.providerId);
    const providerLabel = provider?.displayName ?? connection.providerId;
    const accountLabel = connection.externalAccountId ?? connection.displayLabel ?? '';

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('account.communications.disconnectTitle'),
        message: this.translate.instant('account.communications.disconnectMessage', {
          provider: providerLabel,
          account: accountLabel,
        }),
        confirmLabel: this.translate.instant('account.communications.disconnect'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.service.disconnect(connection.id).subscribe({
        next: () => this.snackbar.success(this.translate.instant('account.communications.disconnected', {
          provider: providerLabel,
        })),
      });
    });
  }

  protected getProviderInfo(providerId: string): CommunicationProviderInfo | undefined {
    return this.service.providers.find(p => p.providerId === providerId);
  }

  protected formatDate(dateStr: string | null): string {
    if (!dateStr) return this.translate.instant('account.communications.never');
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
