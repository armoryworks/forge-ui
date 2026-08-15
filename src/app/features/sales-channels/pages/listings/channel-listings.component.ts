import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { debounceTime, map } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ChannelListingService } from '../../services/channel-listing.service';
import { SalesChannelService } from '../../services/sales-channel.service';
import { ChannelListing } from '../../models/channel-listing.model';
import {
  MapListingDialogComponent,
  MapListingDialogData,
  MapListingDialogResult,
} from './map-listing-dialog/map-listing-dialog.component';

/**
 * Listing triage — the queue of external SKUs that have no part behind them yet.
 *
 * <p>An unmapped listing is not an error and never blocks an import: a
 * marketplace order is already paid for by the time we see it, so its line lands
 * with a description and no part rather than being rejected. What it costs is
 * everything downstream — nothing can allocate stock, cost the line, or push
 * inventory back for a listing with no part. Working this list down is what
 * turns imported orders into real fulfilment.</p>
 */
@Component({
  selector: 'app-channel-listings-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTooltipModule,
    TranslatePipe,
    PageLayoutComponent,
    EmptyStateComponent,
    DataTableComponent,
    ColumnCellDirective,
    SpacerDirective,
    InputComponent,
    SelectComponent,
  ],
  templateUrl: './channel-listings.component.html',
  styleUrl: './channel-listings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelListingsPageComponent {
  private readonly service = inject(ChannelListingService);
  private readonly channelService = inject(SalesChannelService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly listings = signal<ChannelListing[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly syncing = signal(false);
  protected readonly channelOptions = signal<SelectOption[]>([]);

  // URL is the source of truth for the filters — a triage queue is exactly the
  // kind of view someone pastes into chat to say "look at these".
  private readonly channelIdParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => {
      const raw = p.get('channelId');
      const n = raw ? parseInt(raw, 10) : NaN;
      return isNaN(n) ? null : n;
    })),
    { initialValue: null },
  );

  private readonly unmappedOnlyParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => p.get('unmapped') !== 'false')),
    { initialValue: true },
  );

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  private readonly searchTerm = signal('');

  /**
   * Channel filter. Reactive control rather than ngModel (FormsModule is banned
   * in features); its value writes to the URL and the URL is what drives the
   * query, so the control never becomes a second source of truth.
   */
  protected readonly channelControl = new FormControl<number | null>(null);

  protected readonly unmappedOnly = computed(() => this.unmappedOnlyParam() ?? true);
  protected readonly selectedChannelId = computed(() => this.channelIdParam());

  protected readonly isEmpty = computed(() => !this.loading() && this.listings().length === 0);

  protected readonly emptyMessageKey = computed(() =>
    this.unmappedOnly() ? 'channelListings.emptyUnmapped' : 'channelListings.empty',
  );

  protected readonly columns: ColumnDef[] = [
    { field: 'externalSku', header: this.translate.instant('channelListings.colSku'), sortable: true, width: '160px' },
    { field: 'title', header: this.translate.instant('channelListings.colTitle'), sortable: true },
    { field: 'channelName', header: this.translate.instant('channelListings.colChannel'), sortable: true, width: '140px' },
    { field: 'partNumber', header: this.translate.instant('channelListings.colPart'), sortable: true, width: '180px' },
    { field: 'listedPrice', header: this.translate.instant('channelListings.colPrice'), sortable: true, type: 'number', width: '100px', align: 'right' },
    { field: 'publishedQuantity', header: this.translate.instant('channelListings.colPublished'), sortable: true, type: 'number', width: '110px', align: 'right' },
  ];

  constructor() {
    this.channelService.getChannels().subscribe({
      next: (channels) => {
        this.channelOptions.set([
          { value: null, label: this.translate.instant('channelListings.allChannels') },
          ...channels.filter((c) => c.isRetail).map((c) => ({ value: c.id, label: c.name })),
        ]);
      },
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.searchTerm.set(term.trim()));

    this.channelControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((channelId) => this.onChannelChange(channelId ?? null));

    // Seed the control from the URL on first load (deep link / refresh) without
    // echoing straight back into a navigation.
    effect(() => {
      const fromUrl = this.channelIdParam();
      if (this.channelControl.value !== fromUrl) {
        this.channelControl.setValue(fromUrl, { emitEvent: false });
      }
    });

    effect(() => {
      // Re-read on any filter change; the signals below are the dependencies.
      this.channelIdParam();
      this.unmappedOnlyParam();
      this.searchTerm();
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .getListings({
        channelId: this.selectedChannelId() ?? undefined,
        isUnmapped: this.unmappedOnly() ? true : undefined,
        q: this.searchTerm() || undefined,
        pageSize: 100,
      })
      .subscribe({
        next: (page) => {
          this.listings.set(page.items);
          this.totalCount.set(page.totalCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected onChannelChange(channelId: number | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { channelId: channelId ?? null },
      queryParamsHandling: 'merge',
    });
  }

  protected toggleUnmapped(): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { unmapped: this.unmappedOnly() ? 'false' : null },
      queryParamsHandling: 'merge',
    });
  }

  protected syncListings(): void {
    const channelId = this.selectedChannelId();
    if (channelId == null) {
      this.snackbar.error(this.translate.instant('channelListings.pickChannelToSync'));
      return;
    }

    this.syncing.set(true);
    this.service.syncListings(channelId).subscribe({
      next: (result) => {
        this.syncing.set(false);
        this.snackbar.success(
          this.translate.instant('channelListings.syncDone', {
            created: result.created,
            updated: result.updated,
            unmapped: result.unmapped,
          }),
        );
        this.load();
      },
      error: () => this.syncing.set(false),
    });
  }

  protected mapListing(listing: ChannelListing): void {
    this.dialog
      .open<MapListingDialogComponent, MapListingDialogData, MapListingDialogResult>(
        MapListingDialogComponent,
        { width: '520px', autoFocus: false, data: { listing } },
      )
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;

        // Surfacing the back-fill count matters: mapping a listing quietly
        // repairs historical order lines, and a silent success would leave the
        // operator unsure whether the backlog was actually fixed.
        if (result.backfilledOrderLines > 0) {
          this.snackbar.success(
            this.translate.instant('channelListings.mappedWithBackfill', {
              count: result.backfilledOrderLines,
            }),
          );
        } else {
          this.snackbar.success(this.translate.instant('channelListings.mapped'));
        }
        this.load();
      });
  }
}
