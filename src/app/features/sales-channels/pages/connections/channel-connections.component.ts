import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ECommerceConnectionService } from '../../services/ecommerce-connection.service';
import { ECommerceConnection, ECommercePlatformOption } from '../../models/ecommerce-connection.model';
import {
  ConnectionDialogComponent,
  ConnectionDialogData,
  ConnectionDialogResult,
} from './connection-dialog/connection-dialog.component';

/**
 * Storefront and marketplace credentials.
 *
 * <p>Separate from the admin Integrations panel on purpose. That panel is
 * catalog-driven over singleton settings keys — one QuickBooks, one SMTP. A
 * store connection is a row, and a shop can legitimately hold several: two
 * Shopify stores, or a Shopify site plus an Etsy shop, each feeding its own
 * channel.</p>
 *
 * <p>A connection is credentials only. It does not decide where the receivable
 * lands or who owes the tax — that is the channel's job, and a connection does
 * nothing until one is attached to it.</p>
 */
@Component({
  selector: 'app-channel-connections-page',
  standalone: true,
  imports: [
    DatePipe,
    MatTooltipModule,
    TranslatePipe,
    PageLayoutComponent,
    EmptyStateComponent,
    LoadingBlockDirective,
    SpacerDirective,
  ],
  templateUrl: './channel-connections.component.html',
  styleUrl: './channel-connections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelConnectionsPageComponent {
  private readonly service = inject(ECommerceConnectionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly connections = signal<ECommerceConnection[]>([]);
  protected readonly platforms = signal<ECommercePlatformOption[]>([]);
  protected readonly loading = signal(false);
  protected readonly testingId = signal<number | null>(null);

  protected readonly isEmpty = computed(() => !this.loading() && this.connections().length === 0);

  /**
   * Rows with their platform support resolved once. A connection whose platform
   * has no connector cannot be polled or tested, and saying so on the row beats
   * letting someone press Test and read a generic failure.
   */
  protected readonly rows = computed(() => {
    const byPlatform = new Map(this.platforms().map((p) => [p.platform, p]));
    return this.connections().map((connection) => {
      const platform = byPlatform.get(connection.platform);
      return {
        connection,
        isSupported: platform?.isSupported ?? false,
        unavailableReason: platform?.unavailableReason ?? null,
      };
    });
  });

  /** True when at least one platform can actually be connected today. */
  protected readonly canCreate = computed(() => this.platforms().some((p) => p.isSupported));

  constructor() {
    this.loadPlatforms();
    this.load();
  }

  private loadPlatforms(): void {
    this.service.getPlatforms().subscribe({
      next: (platforms) => this.platforms.set(platforms),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getConnections().subscribe({
      next: (connections) => {
        this.connections.set(connections);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected create(): void {
    this.openDialog(null);
  }

  protected edit(connection: ECommerceConnection): void {
    this.openDialog(connection);
  }

  private openDialog(connection: ECommerceConnection | null): void {
    this.dialog
      .open<ConnectionDialogComponent, ConnectionDialogData, ConnectionDialogResult>(
        ConnectionDialogComponent,
        { width: '560px', autoFocus: false, data: { connection, platforms: this.platforms() } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  protected test(connection: ECommerceConnection): void {
    this.testingId.set(connection.id);
    this.service.testConnection(connection.id).subscribe({
      next: (result) => {
        this.testingId.set(null);
        if (result.success) {
          this.snackbar.success(this.translate.instant('connections.testOk'));
        } else {
          // Surface the platform's own message. "Connection failed" alone sends
          // people hunting; "401 Unauthorized" tells them the token is wrong.
          this.snackbar.error(
            result.errorMessage ?? this.translate.instant('connections.testFailed'),
          );
        }
      },
      error: () => this.testingId.set(null),
    });
  }
}
