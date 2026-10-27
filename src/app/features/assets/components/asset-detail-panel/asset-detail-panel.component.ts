import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AssetsService } from '../../services/assets.service';
import { AssetItem } from '../../models/asset-item.model';
import { AssetStatus } from '../../models/asset-status.type';
import { MaintenanceLogListItem } from '../../models/maintenance-log-list-item.model';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { DetailLoadErrorComponent } from '../../../../shared/components/detail-load-error/detail-load-error.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { ASSET_ROLES } from '../../asset-roles';
import { RecordHoursDialogData } from '../../models/record-hours-dialog-data.model';
import { AssetDowntimeSectionComponent } from '../asset-downtime-section/asset-downtime-section.component';
import { RecordHoursDialogComponent } from '../record-hours-dialog/record-hours-dialog.component';

@Component({
  selector: 'app-asset-detail-panel',
  standalone: true,
  imports: [CurrencyDisplayComponent, DatePipe, DecimalPipe, TranslatePipe, MatTooltipModule, BarcodeInfoComponent, EntityActivitySectionComponent, EntityLinkComponent, DetailLoadErrorComponent, AssetDowntimeSectionComponent],
  templateUrl: './asset-detail-panel.component.html',
  styleUrl: './asset-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetDetailPanelComponent {
  private readonly assetsService = inject(AssetsService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);

  readonly assetId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<AssetItem>();

  protected readonly asset = signal<AssetItem | null>(null);
  protected readonly loading = signal(true);
  protected readonly loadError = signal<unknown>(null);
  protected readonly maintenanceLogs = signal<MaintenanceLogListItem[]>([]);
  protected readonly maintenanceLogsLoading = signal(false);

  protected readonly canRecordHours = computed(() =>
    this.capabilities.isEnabled('CAP-MAINT-PM') && this.auth.hasAnyRole([...ASSET_ROLES]));

  protected readonly assetStatuses: AssetStatus[] = ['Active', 'Maintenance', 'Retired', 'OutOfService'];

  constructor() {
    effect(() => {
      const id = this.assetId();
      if (!id) return;
      this.loading.set(true);
      this.loadError.set(null);
      this.assetsService.getAssets(undefined, undefined, undefined).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: (assets) => {
          const found = assets.find(a => a.id === id) ?? null;
          this.asset.set(found);
          this.loading.set(false);
          if (!found) this.loadError.set(new HttpErrorResponse({ status: 404 }));
        },
        error: (err: unknown) => { this.loading.set(false); this.loadError.set(err); },
      });
    });

    effect(() => {
      const id = this.assetId();
      if (!id) {
        this.maintenanceLogs.set([]);
        return;
      }
      this.maintenanceLogsLoading.set(true);
      this.assetsService.getMaintenanceLogs(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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

  protected recordHours(): void {
    const asset = this.asset();
    if (!asset) return;
    this.dialog.open<RecordHoursDialogComponent, RecordHoursDialogData, AssetItem | undefined>(
      RecordHoursDialogComponent, { width: '420px', data: { asset } },
    ).afterClosed().subscribe(updated => {
      if (updated) this.asset.set({ ...asset, currentHours: updated.currentHours });
    });
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

  protected hasAcquisitionDetails(asset: AssetItem): boolean {
    return (asset.acquisitionCost !== null && asset.acquisitionCost !== undefined)
      || !!asset.depreciationMethod || !!asset.workCenterId || !!asset.glAccount;
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
