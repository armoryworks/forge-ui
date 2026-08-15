import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { debounceTime } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { DialogComponent } from '../../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../../shared/components/input/input.component';
import { LoadingBlockDirective } from '../../../../../shared/directives/loading-block.directive';
import { PartsService } from '../../../../parts/services/parts.service';
import { PartListItem } from '../../../../parts/models/part-list-item.model';
import { ChannelListingService, MapListingResult } from '../../../services/channel-listing.service';
import { ChannelListing } from '../../../models/channel-listing.model';

export interface MapListingDialogData {
  listing: ChannelListing;
}

export type MapListingDialogResult = MapListingResult | undefined;

/**
 * Point one external listing at the part it fulfils from.
 *
 * <p>A search-and-pick list rather than a dropdown: the part catalogue is
 * thousands of rows and the operator is arriving from a marketplace SKU they
 * have to recognise, so the useful interaction is "type what I think it is and
 * confirm", not "scroll".</p>
 */
@Component({
  selector: 'app-map-listing-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    DialogComponent,
    InputComponent,
    LoadingBlockDirective,
  ],
  templateUrl: './map-listing-dialog.component.html',
  styleUrl: './map-listing-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapListingDialogComponent {
  private readonly dialogRef =
    inject(MatDialogRef<MapListingDialogComponent, MapListingDialogResult>);
  private readonly data = inject<MapListingDialogData>(MAT_DIALOG_DATA);
  private readonly partsService = inject(PartsService);
  private readonly listingService = inject(ChannelListingService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly listing = this.data.listing;
  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly parts = signal<PartListItem[]>([]);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);
  protected readonly selectedPartId = signal<number | null>(this.data.listing.partId);

  protected readonly hasSelection = computed(() => this.selectedPartId() !== null);
  protected readonly isCleared = computed(
    () => this.data.listing.partId !== null && this.selectedPartId() === null,
  );

  protected readonly listingLabel =
    this.data.listing.externalSku ?? this.data.listing.externalListingId;

  /**
   * Parts with their selected flag resolved here rather than by a method call
   * from the template — a binding to a method re-invokes on every
   * change-detection pass, which the component rules prohibit.
   */
  protected readonly partRows = computed(() => {
    const selected = this.selectedPartId();
    return this.parts().map((part) => ({ part, isSelected: part.id === selected }));
  });

  constructor() {
    this.searchControl.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.search(term.trim()));

    // Seed the list from the listing's own SKU. Sellers very often reuse their
    // internal part number as the marketplace SKU, so the first result is
    // frequently the right answer with no typing at all.
    this.search(this.data.listing.externalSku ?? '');
  }

  private search(term: string): void {
    this.searching.set(true);
    this.partsService.getPartsPaged({ q: term || undefined, pageSize: 25 }).subscribe({
      next: (page) => {
        this.parts.set(page.items);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  protected select(part: PartListItem): void {
    this.selectedPartId.set(this.selectedPartId() === part.id ? null : part.id);
  }

  protected clearMapping(): void {
    this.selectedPartId.set(null);
  }

  protected close(): void {
    this.dialogRef.close(undefined);
  }

  protected save(): void {
    if (this.saving()) return;
    this.saving.set(true);

    this.listingService.mapListing(this.listing.id, this.selectedPartId()).subscribe({
      next: (result) => this.dialogRef.close(result),
      error: () => this.saving.set(false),
    });
  }

  protected readonly saveLabelKey = computed(() =>
    this.isCleared() ? 'channelListings.clearMappingAction' : 'common.save',
  );

  protected readonly title = this.translate.instant('channelListings.mapTitle');
}
