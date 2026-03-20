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

  readonly qbStatusLabel = computed(() => {
    const status = this.qbStatus();
    if (!status) return 'not_configured' as const;
    return status.isConnected ? 'connected' as const : 'not_configured' as const;
  });

  readonly qbCompanyName = computed(() => this.qbStatus()?.companyName ?? null);

  readonly integrations = signal<IntegrationStatus[]>([]);
  readonly testingProvider = signal<string | null>(null);

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

  connectQuickBooks(): void {
    this.qbService.connect();
  }

  disconnectAccounting(): void {
    this.accountingService.disconnect();
  }

  testConnection(): void {
    this.accountingService.testConnection();
  }

  selectProvider(providerId: string): void {
    if (providerId === 'quickbooks') {
      this.qbService.connect();
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
