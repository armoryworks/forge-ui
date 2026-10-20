import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal, untracked } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import { TranslatePipe } from '@ngx-translate/core';

import { AccountingService } from '../../../../shared/services/accounting.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { QuickBooksService } from '../../services/quickbooks.service';
import { AdminService } from '../../services/admin.service';
import { IntegrationStatus } from '../../models/integration-status.model';
import {
  IntegrationConfigDialogComponent,
  IntegrationConfigDialogData,
} from '../integration-config-dialog/integration-config-dialog.component';

const sameOriginLogo = (url: string | null | undefined): string | null =>
  url && url.startsWith('/') && !url.startsWith('//') ? url : null;

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
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);

  readonly providers = this.accountingService.providers;
  readonly activeProviderId = this.accountingService.providerId;
  readonly isConfigured = this.accountingService.isConfigured;
  readonly loading = this.accountingService.loading;
  readonly syncStatus = this.accountingService.syncStatus;

  readonly externalAccountingEnabled = computed(() => this.capabilities.isEnabled('CAP-ACCT-EXTERNAL'));

  readonly qbStatus = this.qbService.status;
  readonly qbLoading = this.qbService.loading;

  readonly integrations = signal<IntegrationStatus[]>([]);
  readonly showSandboxGuides = signal(false);
  readonly testingProvider = signal<string | null>(null);
  readonly logoErrors = signal<string[]>([]);

  readonly productionPosture = signal(false);
  readonly mockIntegrationsInProduction = signal(false);
  readonly gapCount = signal(0);

  readonly gapIntegrations = computed(() => this.integrations().filter(i => i.readiness === 'Gap'));
  readonly showReadinessBanner = computed(
    () => this.mockIntegrationsInProduction() || this.gapCount() > 0,
  );

  readonly qbIntegration = computed(() => this.integrations().find(i => i.provider === 'quickbooks') ?? null);

  /** Accounting providers; no brand logos ship with the app, so each card shows its Material icon. */
  readonly providersWithLogos = computed(() =>
    this.providers().map(p => ({ ...p, logoUrl: null as string | null })),
  );

  readonly shippingIntegrations = computed(() =>
    this.integrations()
      .filter(i => i.category === 'shipping')
      .map(i => ({ ...i, logoUrl: sameOriginLogo(i.logoUrl) })),
  );

  readonly serviceIntegrations = computed(() =>
    this.integrations()
      .filter(i => i.category !== 'shipping' && i.category !== 'accounting')
      .map(i => ({ ...i, logoUrl: sameOriginLogo(i.logoUrl) })),
  );

  readonly isOAuthProvider = (id: string) => OAUTH_PROVIDERS.has(id);

  protected addLogoError(id: string): void {
    this.logoErrors.update(errs => [...errs, id]);
  }

  constructor() {
    effect(() => {
      if (!this.externalAccountingEnabled()) return;
      untracked(() => {
        this.accountingService.loadProviders();
        this.accountingService.loadSyncStatus();
        this.qbService.loadStatus();
      });
    });
  }

  ngOnInit(): void {
    this.loadIntegrations();
  }

  loadIntegrations(): void {
    this.adminService.getIntegrations().subscribe({
      next: (result) => {
        this.integrations.set(result.integrations);
        this.showSandboxGuides.set(result.showSandboxGuides);
        this.productionPosture.set(result.productionPosture ?? false);
        this.mockIntegrationsInProduction.set(result.mockIntegrationsInProduction ?? false);
        this.gapCount.set(result.gapCount ?? 0);
      },
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
          data: { integration, showSandboxGuides: this.showSandboxGuides() } satisfies IntegrationConfigDialogData,
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
        data: { integration, showSandboxGuides: this.showSandboxGuides() } satisfies IntegrationConfigDialogData,
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
      error: (err: unknown) => {
        this.testingProvider.set(null);
        this.snackbar.errorFrom(err, 'integrations.connectionTestFailed');
      },
    });
  }
}
