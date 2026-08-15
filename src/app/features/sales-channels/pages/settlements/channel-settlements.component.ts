import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PageLayoutComponent } from '../../../../shared/components/page-layout/page-layout.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { SpacerDirective } from '../../../../shared/directives/spacer.directive';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ChannelSettlementService } from '../../services/channel-settlement.service';
import { SalesChannelService } from '../../services/sales-channel.service';
import { ChannelSettlement } from '../../models/channel-settlement.model';
import {
  SettlementDetailDialogComponent,
  SettlementDetailDialogData,
  SettlementDetailDialogResult,
} from './settlement-detail-dialog/settlement-detail-dialog.component';

/**
 * Marketplace payout reconciliation.
 *
 * <p>This list exists to answer one question: does the money the marketplace
 * says it sent match the orders and fees that should have produced it. Batches
 * with a discrepancy sort to the top because a reconciled batch needs no
 * attention at all — a list that buries the exceptions among hundreds of clean
 * rows is a list nobody opens.</p>
 */
@Component({
  selector: 'app-channel-settlements-page',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    MatTooltipModule,
    TranslatePipe,
    PageLayoutComponent,
    EmptyStateComponent,
    DataTableComponent,
    ColumnCellDirective,
    SpacerDirective,
    SelectComponent,
  ],
  templateUrl: './channel-settlements.component.html',
  styleUrl: './channel-settlements.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelSettlementsPageComponent {
  private readonly service = inject(ChannelSettlementService);
  private readonly channelService = inject(SalesChannelService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly settlements = signal<ChannelSettlement[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly importing = signal(false);
  protected readonly channelOptions = signal<SelectOption[]>([]);

  private readonly channelIdParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => {
      const raw = p.get('channelId');
      const n = raw ? parseInt(raw, 10) : NaN;
      return isNaN(n) ? null : n;
    })),
    { initialValue: null },
  );

  protected readonly channelControl = new FormControl<number | null>(null);

  protected readonly isEmpty = computed(() => !this.loading() && this.settlements().length === 0);
  protected readonly canImport = computed(() => this.channelIdParam() !== null && !this.importing());

  /** Count of batches needing a human, surfaced in the toolbar so it is visible without scanning. */
  protected readonly discrepancyCount = computed(
    () => this.settlements().filter((s) => s.status === 'Discrepancy').length,
  );

  protected readonly columns: ColumnDef[] = [
    { field: 'externalSettlementId', header: this.translate.instant('settlements.colBatch'), sortable: true, width: '190px' },
    { field: 'channelName', header: this.translate.instant('settlements.colChannel'), sortable: true, width: '140px' },
    { field: 'periodEnd', header: this.translate.instant('settlements.colPeriod'), sortable: true, type: 'date', width: '190px' },
    { field: 'reportedNetAmount', header: this.translate.instant('settlements.colReported'), sortable: true, type: 'number', width: '130px', align: 'right' },
    { field: 'variance', header: this.translate.instant('settlements.colVariance'), sortable: true, type: 'number', width: '130px', align: 'right' },
    { field: 'status', header: this.translate.instant('settlements.colStatus'), sortable: true, width: '130px' },
  ];

  constructor() {
    this.channelService.getChannels().subscribe({
      next: (channels) => {
        this.channelOptions.set([
          { value: null, label: this.translate.instant('settlements.allChannels') },
          // Only marketplaces settle through a payout batch — a storefront's
          // money arrives through your own processor, so offering one here
          // would promise an import that can never return anything.
          ...channels
            .filter((c) => c.channelType === 'Marketplace')
            .map((c) => ({ value: c.id, label: c.name })),
        ]);
      },
    });

    this.channelControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((channelId) => {
        this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { channelId: channelId ?? null },
          queryParamsHandling: 'merge',
        });
      });

    effect(() => {
      const fromUrl = this.channelIdParam();
      if (this.channelControl.value !== fromUrl) {
        this.channelControl.setValue(fromUrl, { emitEvent: false });
      }
    });

    effect(() => {
      this.channelIdParam();
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .getSettlements({ channelId: this.channelIdParam() ?? undefined, pageSize: 100 })
      .subscribe({
        next: (page) => {
          this.settlements.set(page.items);
          this.totalCount.set(page.totalCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected importSettlements(): void {
    const channelId = this.channelIdParam();
    if (channelId == null) return;

    this.importing.set(true);
    this.service.importSettlements(channelId).subscribe({
      next: (result) => {
        this.importing.set(false);
        this.snackbar.success(
          this.translate.instant('settlements.importDone', {
            imported: result.imported,
            updated: result.updated,
            discrepancies: result.withDiscrepancy,
          }),
        );
        this.load();
      },
      error: () => this.importing.set(false),
    });
  }

  protected openDetail(settlement: ChannelSettlement): void {
    this.dialog
      .open<SettlementDetailDialogComponent, SettlementDetailDialogData, SettlementDetailDialogResult>(
        SettlementDetailDialogComponent,
        { width: '820px', autoFocus: false, data: { settlementId: settlement.id } },
      )
      .afterClosed()
      .subscribe((changed) => {
        if (changed) this.load();
      });
  }
}
