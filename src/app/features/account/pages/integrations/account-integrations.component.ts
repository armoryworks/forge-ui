import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { formatDateTime } from '../../../../shared/utils/date.utils';
import { UserIntegrationService } from '../../services/user-integration.service';
import { IntegrationProviderInfo, UserIntegrationSummary } from '../../models/user-integration.model';
import { ConnectIntegrationDialogComponent, ConnectIntegrationDialogData } from './connect-integration-dialog.component';

interface CategoryGroup {
  category: string;
  label: string;
  icon: string;
  connected: UserIntegrationSummary[];
  available: IntegrationProviderInfo[];
}

@Component({
  selector: 'app-account-integrations',
  standalone: true,
  imports: [TranslatePipe, EmptyStateComponent, LoadingBlockDirective],
  templateUrl: './account-integrations.component.html',
  styleUrl: './account-integrations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountIntegrationsComponent implements OnInit {
  private readonly integrationService = inject(UserIntegrationService);
  private readonly translate = inject(TranslateService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  protected readonly loading = this.integrationService.loading;
  protected readonly testing = signal<number | null>(null);

  protected readonly categoryGroups = computed<CategoryGroup[]>(() => {
    const integrations = this.integrationService.integrations();
    const providers = this.integrationService.providers();

    const categories = [
      { category: 'calendar', label: 'Calendar', icon: 'event' },
      { category: 'messaging', label: 'Messaging', icon: 'chat' },
      { category: 'storage', label: 'Cloud Storage', icon: 'cloud' },
      { category: 'other', label: 'Other', icon: 'extension' },
    ];

    return categories.map(cat => {
      const connected = integrations.filter(i => i.category === cat.category);
      const connectedProviderIds = new Set(connected.map(c => c.providerId));
      const available = providers
        .filter(p => p.category === cat.category && !connectedProviderIds.has(p.providerId));

      return { ...cat, connected, available };
    }).filter(group => group.connected.length > 0 || group.available.length > 0);
  });

  ngOnInit(): void {
    this.integrationService.loadIntegrations();
    this.integrationService.loadProviders();
  }

  protected connectProvider(provider: IntegrationProviderInfo): void {
    this.dialog.open(ConnectIntegrationDialogComponent, {
      width: '480px',
      data: { provider } satisfies ConnectIntegrationDialogData,
    }).afterClosed().subscribe(result => {
      if (result) {
        this.integrationService.loadIntegrations();
      }
    });
  }

  protected testConnection(integration: UserIntegrationSummary): void {
    this.testing.set(integration.id);
    this.integrationService.testConnection(integration.id).subscribe({
      next: (result) => {
        this.testing.set(null);
        if (result.success && !result.contacted) {
          this.snackbar.info(this.translate.instant('integrations.messages.savedUnverified'));
        } else if (result.success) {
          this.snackbar.success(this.translate.instant('integrations.messages.testPassed'));
        } else {
          this.snackbar.error(this.translate.instant('integrations.connectionTestFailed'));
        }
      },
      error: (err: unknown) => {
        this.testing.set(null);
        this.snackbar.errorFrom(err, 'integrations.connectionTestFailed');
      },
    });
  }

  protected disconnect(integration: UserIntegrationSummary): void {
    const providerLabel = this.integrationService.providers()
      .find(p => p.providerId === integration.providerId)?.displayName ?? integration.providerId;

    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('integrations.messages.disconnectTitle'),
        message: this.translate.instant('integrations.messages.disconnectMessage', { provider: integration.displayName ? `${providerLabel} (${integration.displayName})` : providerLabel }),
        confirmLabel: this.translate.instant('integrations.disconnect'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.integrationService.disconnect(integration.id).subscribe({
          next: () => this.snackbar.success(this.translate.instant('integrations.messages.disconnected', { provider: providerLabel })),
        });
      }
    });
  }

  protected getProviderLabel(providerId: string): string {
    return this.integrationService.providers().find(p => p.providerId === providerId)?.displayName ?? providerId;
  }

  protected getProviderIcon(providerId: string): string {
    return this.integrationService.providers().find(p => p.providerId === providerId)?.icon ?? 'extension';
  }

  protected formatDate(dateStr: string | null): string {
    return dateStr ? formatDateTime(dateStr) : this.translate.instant('integrations.never');
  }
}
