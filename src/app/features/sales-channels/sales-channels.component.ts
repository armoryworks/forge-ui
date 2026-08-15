import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../shared/directives/loading-block.directive';
import { SpacerDirective } from '../../shared/directives/spacer.directive';
import { SalesChannelService } from './services/sales-channel.service';
import { ChannelListingService } from './services/channel-listing.service';
import { SalesChannel } from './models/sales-channel.model';
import { SalesChannelCard } from './models/sales-channel-card.model';
import {
  SalesChannelDialogComponent,
  SalesChannelDialogData,
  SalesChannelDialogResult,
} from './components/sales-channel-dialog/sales-channel-dialog.component';
import {
  RetailOrderDialogComponent,
  RetailOrderDialogResult,
} from './components/retail-order-dialog/retail-order-dialog.component';

/**
 * Sales-channel administration — the routing layer above sales orders.
 *
 * <p>Presented as cards rather than a data table because a channel is
 * configuration, not a record: an install has a handful, each carries a few
 * decisions that matter (who the receivable bills to, who owes the tax), and
 * those decisions need to be readable at a glance rather than sorted and
 * filtered.</p>
 */
@Component({
  selector: 'app-sales-channels',
  standalone: true,
  imports: [
    NgTemplateOutlet,
    MatTooltipModule,
    TranslatePipe,
    PageLayoutComponent,
    EmptyStateComponent,
    LoadingBlockDirective,
    SpacerDirective,
  ],
  templateUrl: './sales-channels.component.html',
  styleUrl: './sales-channels.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesChannelsComponent {
  private readonly service = inject(SalesChannelService);
  private readonly listingService = inject(ChannelListingService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  protected readonly channels = signal<SalesChannel[]>([]);
  protected readonly loading = signal(false);
  protected readonly showInactive = signal(false);

  /** Channel id currently importing, so only that card's button spins. */
  protected readonly importingChannelId = signal<number | null>(null);

  /**
   * Account channels first, then retail. The two groups are read for different
   * reasons — one is "where does normal business go", the other is "what are we
   * selling through" — so mixing them alphabetically helps nobody.
   */
  protected readonly accountChannels = computed(() =>
    this.channels().filter((c) => !c.isRetail).map(toCard),
  );
  protected readonly retailChannels = computed(() =>
    this.channels().filter((c) => c.isRetail).map(toCard),
  );

  protected readonly isEmpty = computed(() => !this.loading() && this.channels().length === 0);

  /**
   * Manual retail entry is only meaningful once a retail channel exists —
   * without one there is no house account for the receivable to land on.
   */
  protected readonly canTakeRetailOrder = computed(
    () => this.retailChannels().some((c) => c.channel.isActive),
  );

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.getChannels(this.showInactive()).subscribe({
      next: (channels) => {
        this.channels.set(channels);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected toggleInactive(): void {
    this.showInactive.update((v) => !v);
    this.load();
  }

  protected create(): void {
    this.openDialog(null);
  }

  protected edit(channel: SalesChannel): void {
    this.openDialog(channel);
  }

  private openDialog(channel: SalesChannel | null): void {
    this.dialog
      .open<SalesChannelDialogComponent, SalesChannelDialogData, SalesChannelDialogResult>(
        SalesChannelDialogComponent,
        { width: '560px', autoFocus: false, data: { channel } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (result) this.load();
      });
  }

  /**
   * Pull orders from a connected channel. Reports the split rather than a bare
   * success — a poll that imports nothing because everything was already seen is
   * a different outcome from one that found nothing, and a failure count that
   * disappears into a green toast is how bad imports go unnoticed.
   */
  protected importOrders(channel: SalesChannel): void {
    this.importingChannelId.set(channel.id);
    this.listingService.importOrders(channel.id).subscribe({
      next: (results) => {
        this.importingChannelId.set(null);
        const imported = results.filter((r) => r.status === 'Imported').length;
        const skipped = results.filter((r) => r.status === 'Skipped').length;
        const failed = results.filter((r) => r.status === 'Failed').length;

        if (failed > 0) {
          this.snackbar.warn(
            this.translate.instant('salesChannels.importPartial', { imported, skipped, failed }),
          );
        } else {
          this.snackbar.success(
            this.translate.instant('salesChannels.importDone', { imported, skipped }),
          );
        }
        this.load();
      },
      error: () => this.importingChannelId.set(null),
    });
  }

  /** Walk-in, phone and trade-show orders. Same endpoint the channel importers use. */
  protected takeRetailOrder(): void {
    this.dialog
      .open<RetailOrderDialogComponent, undefined, RetailOrderDialogResult>(
        RetailOrderDialogComponent,
        { width: '800px', autoFocus: false },
      )
      .afterClosed()
      .subscribe((order) => {
        if (order) this.load();
      });
  }

  protected setDefault(channel: SalesChannel): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '440px',
        data: {
          title: this.translate.instant('salesChannels.setDefaultTitle'),
          message: this.translate.instant('salesChannels.setDefaultMessage', { name: channel.name }),
          confirmLabel: this.translate.instant('salesChannels.setDefaultConfirm'),
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.service.setDefault(channel.id).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('salesChannels.setDefaultDone'));
            this.load();
          },
        });
      });
  }

  protected remove(channel: SalesChannel): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '440px',
        data: {
          title: this.translate.instant('salesChannels.deleteTitle'),
          message: this.translate.instant('salesChannels.deleteMessage', { name: channel.name }),
          confirmLabel: this.translate.instant('common.delete'),
          severity: 'danger',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.service.deleteChannel(channel.id).subscribe({
          next: () => {
            this.snackbar.success(this.translate.instant('salesChannels.deleted'));
            this.load();
          },
        });
      });
  }

}

/**
 * Derives the per-card presentation once, at the point the list changes. Doing
 * this in the template would mean a method call per row per change-detection
 * pass, which the component rules prohibit.
 */
function toCard(channel: SalesChannel): SalesChannelCard {
  const typeChipClass =
    channel.channelType === 'Marketplace' ? 'chip chip--warning'
    : channel.channelType === 'DirectRetail' ? 'chip chip--info'
    : 'chip chip--muted';

  return {
    channel,
    typeLabelKey: `salesChannels.type.${channel.channelType}`,
    typeChipClass,
    canMakeDefault: !channel.isDefault && !channel.isRetail && channel.isActive,
    canDelete: !channel.isDefault,
    canImport: channel.isRetail && channel.isActive && channel.eCommerceIntegrationId !== null,
  };
}
