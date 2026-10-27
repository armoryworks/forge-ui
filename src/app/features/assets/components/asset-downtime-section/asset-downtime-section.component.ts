import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DateTimePipe } from '../../../../shared/pipes/date-time.pipe';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ASSET_ROLES } from '../../asset-roles';
import { AssetItem } from '../../models/asset-item.model';
import { DowntimeDialogData } from '../../models/downtime-dialog-data.model';
import { DowntimeLog } from '../../models/downtime-log.model';
import { AssetsService } from '../../services/assets.service';
import { DowntimeDialogComponent } from '../downtime-dialog/downtime-dialog.component';

@Component({
  selector: 'app-asset-downtime-section',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, LoadingBlockDirective, DateTimePipe],
  templateUrl: './asset-downtime-section.component.html',
  styleUrl: './asset-downtime-section.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssetDowntimeSectionComponent {
  readonly asset = input.required<AssetItem>();

  private readonly assetsService = inject(AssetsService);
  private readonly auth = inject(AuthService);
  private readonly capabilities = inject(CapabilityService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly logs = signal<DowntimeLog[]>([]);
  readonly loading = signal(false);
  readonly endingId = signal<number | null>(null);

  readonly visible = computed(() =>
    this.capabilities.isEnabled('CAP-MAINT-BREAKDOWN') && this.auth.hasAnyRole([...ASSET_ROLES]));
  readonly hasOpen = computed(() => this.logs().some(log => log.endedAt == null));

  constructor() {
    effect(() => {
      const id = this.asset().id;
      if (this.visible()) untracked(() => this.load(id));
    });
  }

  private load(assetId: number): void {
    this.loading.set(true);
    this.assetsService.getDowntimeLogs(assetId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: logs => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  start(): void {
    this.dialog.open<DowntimeDialogComponent, DowntimeDialogData, DowntimeLog | undefined>(
      DowntimeDialogComponent, { width: '480px', data: { asset: this.asset() } },
    ).afterClosed().subscribe(log => {
      if (log) this.load(this.asset().id);
    });
  }

  end(log: DowntimeLog): void {
    if (this.endingId() !== null) return;
    this.endingId.set(log.id);
    this.assetsService.endDowntimeLog(log.id).subscribe({
      next: () => {
        this.endingId.set(null);
        this.snackbar.success(this.translate.instant('downtime.ended', { asset: log.assetName }));
        this.load(this.asset().id);
      },
      error: (err: unknown) => {
        this.endingId.set(null);
        this.snackbar.errorFrom(err, 'downtime.saveFailed');
      },
    });
  }
}
