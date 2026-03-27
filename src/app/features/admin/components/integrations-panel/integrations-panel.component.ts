import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AccountingService } from '../../../../shared/services/accounting.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { QuickBooksService } from '../../services/quickbooks.service';
import { AdminService } from '../../services/admin.service';
import { IntegrationStatus } from '../../models/integration-status.model';
import {
  IntegrationConfigDialogComponent,
  IntegrationConfigDialogData,
} from '../integration-config-dialog/integration-config-dialog.component';

// Providers that use OAuth (redirect to external auth page)
const OAUTH_PROVIDERS = new Set(['quickbooks', 'xero', 'freshbooks', 'sage', 'zoho']);

@Component({
  selector: 'app-integrations-panel',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './integrations-panel.component.html',
  styleUrl: './integrations-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IntegrationsPanelComponent implements OnInit {
  protected readonly accountingService = inject(AccountingService);
  private readonly qbService = inject(QuickBooksService);
  private readonly adminService = inject(AdminService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly providers = this.accountingService.providers;
  readonly activeProviderId = this.accountingService.providerId;
  readonly isConfigured = this.accountingService.isConfigured;
  readonly loading = this.accountingService.loading;
  readonly syncStatus = this.accountingService.syncStatus;

  readonly qbStatus = this.qbService.status;
  readonly qbLoading = this.qbService.loading;

  readonly integrations = signal<IntegrationStatus[]>([]);
  readonly testingProvider = signal<string | null>(null);

  readonly shippingIntegrations = computed(() =>
    this.integrations().filter(i => i.category === 'shipping'),
  );

  readonly serviceIntegrations = computed(() =>
    this.integrations().filter(i => i.category === 'service'),
  );

  readonly isOAuthProvider = (id: string) => OAUTH_PROVIDERS.has(id);

  ngOnInit(): void {
    this.accountingService.loadProviders();
    this.accountingService.loadSyncStatus();
    this.qbService.loadStatus();
    this.loadIntegrations();
  }

  loadIntegrations(): void {
    this.adminService.getIntegrations().subscribe({
      next: (data) => this.integrations.set(data),
    });
  }

  /** Returns true if credentials have been saved for an accounting provider. */
  isCredentialsConfigured(providerId: string): boolean {
    return this.integrations().find(i => i.provider === providerId)?.isConfigured ?? false;
  }

  /**
   * Initiates the connect/activate flow for an accounting provider.
   * - local: set as active provider
   * - quickbooks: QB OAuth redirect
   * - xero/freshbooks/sage/zoho: OAuth redirect via AccountingService
   * - netsuite/wave: set as active provider (credentials-only)
   */
  connectProvider(providerId: string): void {
    if (providerId === 'local') {
      this.accountingService.setActiveProvider('local');
    } else if (providerId === 'quickbooks') {
      this.qbService.connect();
    } else if (OAUTH_PROVIDERS.has(providerId)) {
      this.accountingService.connectOAuth(providerId);
    } else {
      this.accountingService.setActiveProvider(providerId);
    }
  }

  disconnectAccounting(): void {
    this.accountingService.disconnect();
  }

  testConnection(): void {
    this.accountingService.testConnection();
  }

  configureProviderCredentials(providerId: string): void {
    const integration = this.integrations().find(i => i.provider === providerId);
    if (integration) {
      this.dialog
        .open(IntegrationConfigDialogComponent, {
          width: '520px',
          data: { integration } satisfies IntegrationConfigDialogData,
        })
        .afterClosed()
        .subscribe((saved: boolean) => {
          if (saved) this.loadIntegrations();
        });
    }
  }

  configureIntegration(integration: IntegrationStatus): void {
    this.dialog
      .open(IntegrationConfigDialogComponent, {
        width: '520px',
        data: { integration } satisfies IntegrationConfigDialogData,
      })
      .afterClosed()
      .subscribe((saved: boolean) => {
        if (saved) this.loadIntegrations();
      });
  }

  testIntegration(integration: IntegrationStatus): void {
    this.testingProvider.set(integration.provider);
    this.adminService.testIntegration(integration.provider).subscribe({
      next: (result) => {
        this.testingProvider.set(null);
        if (result.success) {
          this.snackbar.success(result.message);
        } else {
          this.snackbar.error(result.message);
        }
      },
      error: () => {
        this.testingProvider.set(null);
        this.snackbar.error(this.translate.instant('integrations.connectionTestFailed'));
      },
    });
  }
}
