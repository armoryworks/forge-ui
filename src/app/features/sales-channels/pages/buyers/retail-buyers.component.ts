import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
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
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { RetailBuyerService } from '../../services/retail-buyer.service';
import { SalesChannelService } from '../../services/sales-channel.service';
import { RetailBuyer } from '../../models/retail-buyer.model';

/**
 * Retail buyers — the consumers behind channel orders.
 *
 * <p>Deliberately a separate list from Customers. These are not accounts: they
 * have no credit, no terms, no price lists, and there are thousands of them.
 * Mixing them into the customer master would bury the few hundred real accounts
 * that the credit, statement and pricing surfaces are built around.</p>
 *
 * <p>The scrub action is destructive and irreversible, so it is confirmed with
 * an explicit warning and restricted to Admin server-side. It removes identity,
 * not history — the buyer's orders and totals survive a scrub.</p>
 */
@Component({
  selector: 'app-retail-buyers-page',
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
    InputComponent,
    SelectComponent,
  ],
  templateUrl: './retail-buyers.component.html',
  styleUrl: './retail-buyers.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetailBuyersPageComponent {
  private readonly service = inject(RetailBuyerService);
  private readonly channelService = inject(SalesChannelService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly buyers = signal<RetailBuyer[]>([]);
  protected readonly totalCount = signal(0);
  protected readonly loading = signal(false);
  protected readonly channelOptions = signal<SelectOption[]>([]);

  private readonly channelIdParam = toSignal(
    this.route.queryParamMap.pipe(map((p) => {
      const raw = p.get('channelId');
      const n = raw ? parseInt(raw, 10) : NaN;
      return isNaN(n) ? null : n;
    })),
    { initialValue: null },
  );

  protected readonly searchControl = new FormControl('', { nonNullable: true });
  protected readonly channelControl = new FormControl<number | null>(null);
  private readonly searchTerm = signal('');

  protected readonly isEmpty = computed(() => !this.loading() && this.buyers().length === 0);

  protected readonly columns: ColumnDef[] = [
    { field: 'displayName', header: this.translate.instant('retailBuyers.colName'), sortable: true },
    { field: 'channelName', header: this.translate.instant('retailBuyers.colChannel'), sortable: true, width: '150px' },
    { field: 'contactEmail', header: this.translate.instant('retailBuyers.colEmail'), sortable: true },
    { field: 'orderCount', header: this.translate.instant('retailBuyers.colOrders'), sortable: true, type: 'number', width: '90px', align: 'right' },
    { field: 'lifetimeValue', header: this.translate.instant('retailBuyers.colLifetimeValue'), sortable: true, type: 'number', width: '130px', align: 'right' },
    { field: 'lastOrderAt', header: this.translate.instant('retailBuyers.colLastOrder'), sortable: true, type: 'date', width: '120px' },
    { field: 'actions', header: '', width: '60px', align: 'center' },
  ];

  constructor() {
    this.channelService.getChannels().subscribe({
      next: (channels) => {
        this.channelOptions.set([
          { value: null, label: this.translate.instant('retailBuyers.allChannels') },
          ...channels.filter((c) => c.isRetail).map((c) => ({ value: c.id, label: c.name })),
        ]);
      },
    });

    this.searchControl.valueChanges
      .pipe(debounceTime(250), takeUntilDestroyed(this.destroyRef))
      .subscribe((term) => this.searchTerm.set(term.trim()));

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
      this.searchTerm();
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);
    this.service
      .getBuyers({
        channelId: this.channelIdParam() ?? undefined,
        q: this.searchTerm() || undefined,
        pageSize: 100,
      })
      .subscribe({
        next: (page) => {
          this.buyers.set(page.items);
          this.totalCount.set(page.totalCount);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected purge(buyer: RetailBuyer): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '480px',
        data: {
          title: this.translate.instant('retailBuyers.purgeTitle'),
          message: this.translate.instant('retailBuyers.purgeMessage', { name: buyer.displayName }),
          confirmLabel: this.translate.instant('retailBuyers.purgeConfirm'),
          severity: 'danger',
        } satisfies ConfirmDialogData,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.service.purgePii(buyer.id).subscribe({
          next: (result) => {
            this.snackbar.success(
              this.translate.instant('retailBuyers.purgeDone', {
                addresses: result.addressesPurged,
              }),
            );
            this.load();
          },
        });
      });
  }
}
