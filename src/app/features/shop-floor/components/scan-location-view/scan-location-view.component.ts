import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { InventoryService } from '../../../inventory/services/inventory.service';
import { BinContentItem } from '../../../inventory/models/bin-content-item.model';

@Component({
  selector: 'app-scan-location-view',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './scan-location-view.component.html',
  styleUrl: './scan-location-view.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScanLocationViewComponent {
  private readonly inventoryService = inject(InventoryService);

  readonly locationId = input.required<number>();
  readonly locationName = input.required<string>();

  readonly scanPart = output<BinContentItem>();
  readonly closed = output<void>();

  protected readonly contents = signal<BinContentItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly hasContents = computed(() => this.contents().length > 0);

  loadContents(): void {
    this.loading.set(true);
    this.error.set(null);

    this.inventoryService.getBinContents(this.locationId()).subscribe({
      next: (items) => {
        this.contents.set(items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load location contents');
        this.loading.set(false);
      },
    });
  }

  protected onScanPart(item: BinContentItem): void {
    this.scanPart.emit(item);
  }

  protected onClose(): void {
    this.closed.emit();
  }
}
