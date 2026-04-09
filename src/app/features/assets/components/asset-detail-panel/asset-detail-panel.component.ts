import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AssetsService } from '../../services/assets.service';
import { AssetItem } from '../../models/asset-item.model';
import { AssetStatus } from '../../models/asset-status.type';
import { MaintenanceLogListItem } from '../../models/maintenance-log-list-item.model';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';

@Component({
  selector: 'app-asset-detail-panel',
  standalone: true,
  imports: [DatePipe, DecimalPipe, TranslatePipe, MatTooltipModule, BarcodeInfoComponent, EntityActivitySectionComponent],
  templateUrl: './asset-detail-panel.component.html',
  styleUrl: './asset-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetDetailPanelComponent {
  private readonly assetsService = inject(AssetsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly assetId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<AssetItem>();

  protected readonly asset = signal<AssetItem | null>(null);
  protected readonly loading = signal(true);
  protected readonly maintenanceLogs = signal<MaintenanceLogListItem[]>([]);
  protected readonly maintenanceLogsLoading = signal(false);

  protected readonly assetStatuses: AssetStatus[] = ['Active', 'Maintenance', 'Retired', 'OutOfService'];

  constructor() {
    effect(() => {
      const id = this.assetId();
      if (!id) return;
      this.loading.set(true);
      this.assetsService.getAssets(undefined, undefined, undefined).subscribe({
        next: (assets) => {
          const found = assets.find(a => a.id === id) ?? null;
          this.asset.set(found);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    });

    effect(() => {
      const id = this.assetId();
      if (!id) {
        this.maintenanceLogs.set([]);
        return;
      }
      this.maintenanceLogsLoading.set(true);
      this.assetsService.getMaintenanceLogs(id).subscribe({
        next: (logs) => { this.maintenanceLogs.set(logs); this.maintenanceLogsLoading.set(false); },
        error: () => this.maintenanceLogsLoading.set(false),
      });
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected edit(): void {
    const asset = this.asset();
    if (asset) this.editRequested.emit(asset);
  }

  protected updateStatus(status: AssetStatus): void {
    const asset = this.asset();
    if (!asset) return;
    this.assetsService.updateAsset(asset.id, { status }).subscribe({
      next: (updated) => {
        this.asset.set(updated);
        this.snackbar.success(this.translate.instant('assets.assetUpdated'));
      },
    });
  }

  protected getTypeIcon(type: string): string {
    switch (type) {
      case 'Machine': return 'precision_manufacturing';
      case 'Tooling': return 'build';
      case 'Facility': return 'apartment';
      case 'Vehicle': return 'local_shipping';
      default: return 'category';
    }
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Active: 'chip--success', Maintenance: 'chip--warning',
      Retired: 'chip--muted', OutOfService: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    return status === 'OutOfService' ? 'Out of Service' : status;
  }
}
