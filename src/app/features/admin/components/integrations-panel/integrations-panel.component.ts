import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

// Provider ID → Simple Icons CDN URL (open-source brand icon set, MIT licensed)
// Format: https://cdn.simpleicons.org/{slug}/{hex-color}
// Falls back to Material icon on load error.
const LOGO_MAP: Record<string, string> = {
  // Accounting
  quickbooks: 'https://cdn.simpleicons.org/intuit/2CA01C',
  xero:       'https://cdn.simpleicons.org/xero/13B5EA',
  sage:       'https://cdn.simpleicons.org/sage/00D639',
  netsuite:   'https://logos-world.net/wp-content/uploads/2021/09/NetSuite-Emblem.png',
  zoho:       'https://cdn.simpleicons.org/zoho/E42527',
  // Shipping
  ups:        'https://cdn.simpleicons.org/ups/351C15',
  fedex:      'https://cdn.simpleicons.org/fedex/4D148C',
  dhl:        'https://cdn.simpleicons.org/dhl/D40511',
  usps:       'https://cdn.simpleicons.org/usps/004B87',
  // Services
  minio:      'https://cdn.simpleicons.org/minio/C72E49',
  ollama:     'https://cdn.simpleicons.org/ollama/000000',
  docuseal:   'https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/docuseal.svg',
  // Direct brand assets (not in Simple Icons)
  freshbooks: 'https://www.freshbooks.com/apple-icon1.png',
  wave:       'https://cdn.prod.website-files.com/62446230dcb514b828a6e237/677ed61188695f2316217fc5_Wave-2_0-logo-fullcolour-rgb.svg',
  stamps:     'https://www.stamps.com/wp-content/uploads/2025/01/Stamps-Primary-Lockup-Red-RGB.svg',
};

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
  readonly showSandboxGuides = signal(false);
  readonly testingProvider = signal<string | null>(null);
  readonly logoErrors = signal<string[]>([]);

  readonly qbIntegration = computed(() => this.integrations().find(i => i.provider === 'quickbooks') ?? null);

  /** Accounting providers enriched with logo URLs from the static map. */
  readonly providersWithLogos = computed(() =>
    this.providers().map(p => ({ ...p, logoUrl: LOGO_MAP[p.id] ?? null })),
  );

  readonly shippingIntegrations = computed(() =>
    this.integrations()
      .filter(i => i.category === 'shipping')
      .map(i => ({ ...i, logoUrl: LOGO_MAP[i.provider] ?? i.logoUrl ?? null })),
  );

  readonly serviceIntegrations = computed(() =>
    this.integrations()
      .filter(i => i.category === 'service')
      .map(i => ({ ...i, logoUrl: LOGO_MAP[i.provider] ?? i.logoUrl ?? null })),
  );

  readonly isOAuthProvider = (id: string) => OAUTH_PROVIDERS.has(id);

  protected addLogoError(id: string): void {
    this.logoErrors.update(errs => [...errs, id]);
  }

  ngOnInit(): void {
    this.accountingService.loadProviders();
    this.accountingService.loadSyncStatus();
    this.qbService.loadStatus();
    this.loadIntegrations();
  }

  loadIntegrations(): void {
    this.adminService.getIntegrations().subscribe({
      next: (result) => {
        this.integrations.set(result.integrations);
        this.showSandboxGuides.set(result.showSandboxGuides);
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
      error: () => {
        this.testingProvider.set(null);
        this.snackbar.error(this.translate.instant('integrations.connectionTestFailed'));
      },
    });
  }
}
