import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';

import { SalesOrderService } from '../../services/sales-order.service';
import { SalesOrderDetail } from '../../models/sales-order-detail.model';
import { SalesOrderLine } from '../../models/sales-order-line.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';

type TabId = 'overview' | 'lines' | 'shipments' | 'returns' | 'activity';

@Component({
  selector: 'app-sales-order-detail-panel',
  standalone: true,
  imports: [
    DatePipe, CurrencyPipe, TranslatePipe,
    MatTooltipModule, LoadingBlockDirective,
    BarcodeInfoComponent, EntityActivitySectionComponent,
    EntityLinkComponent,
  ],
  templateUrl: './sales-order-detail-panel.component.html',
  styleUrl: './sales-order-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SalesOrderDetailPanelComponent {
  private readonly soService = inject(SalesOrderService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly salesOrderId = input.required<number>();
  readonly closed = output<void>();
  readonly editRequested = output<SalesOrderDetail>();
  readonly changed = output<void>();

  protected readonly so = signal<SalesOrderDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly activeTab = signal<TabId>('overview');
  protected readonly expandedLines = signal<Set<number>>(new Set());

  protected readonly hasData = computed(() => this.so() !== null);

  protected readonly shipmentCount = computed(() => this.so()?.shipments?.length ?? 0);

  protected readonly hasShipmentWarning = computed(() => {
    const so = this.so();
    if (!so) return false;
    const status = so.status;
    if (status === 'Draft' || status === 'Cancelled') return false;
    return so.lines.some(l => l.remainingQuantity > 0);
  });

  protected readonly openReturnCount = computed(() => {
    const so = this.so();
    if (!so) return 0;
    return so.returns?.filter(r => r.status !== 'Closed').length ?? 0;
  });

  protected readonly fulfillmentSummary = computed(() => {
    const so = this.so();
    if (!so) return null;
    const totalLines = so.lines.length;
    const linesWithJobs = so.lines.filter(l => l.jobs.length > 0).length;
    const linesShipped = so.lines.filter(l => l.isFullyShipped).length;
    const shipmentCount = so.shipments?.length ?? 0;
    return { totalLines, linesWithJobs, linesShipped, shipmentCount };
  });

  protected readonly linesWithNoJobs = computed(() => {
    const so = this.so();
    if (!so) return [];
    const status = so.status;
    if (status === 'Draft' || status === 'Cancelled') return [];
    return so.lines.filter(l => l.jobs.length === 0);
  });

  constructor() {
    effect(() => {
      const id = this.salesOrderId();
      if (id) {
        this.loadDetail(id);
      }
    });
  }

  private loadDetail(id: number): void {
    this.loading.set(true);
    this.soService.getSalesOrderById(id).subscribe({
      next: (detail) => { this.so.set(detail); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected switchTab(tab: TabId): void {
    this.activeTab.set(tab);
  }

  protected toggleLineExpand(lineId: number): void {
    const current = new Set(this.expandedLines());
    if (current.has(lineId)) {
      current.delete(lineId);
    } else {
      current.add(lineId);
    }
    this.expandedLines.set(current);
  }

  protected isLineExpanded(lineId: number): boolean {
    return this.expandedLines().has(lineId);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected confirmSo(): void {
    const so = this.so();
    if (!so) return;
    this.soService.confirmSalesOrder(so.id).subscribe({
      next: () => {
        this.loadDetail(so.id);
        this.changed.emit();
        this.snackbar.success(this.translate.instant('salesOrders.soConfirmed'));
      },
    });
  }

  protected cancelSo(): void {
    const so = this.so();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.cancelSoTitle'),
        message: this.translate.instant('salesOrders.cancelSoMessage', { number: so.orderNumber }),
        confirmLabel: this.translate.instant('salesOrders.cancelOrder'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.cancelSalesOrder(so.id).subscribe({
        next: () => {
          this.loadDetail(so.id);
          this.changed.emit();
          this.snackbar.success(this.translate.instant('salesOrders.soCancelled'));
        },
      });
    });
  }

  protected deleteSo(): void {
    const so = this.so();
    if (!so) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('salesOrders.deleteSoTitle'),
        message: this.translate.instant('salesOrders.deleteSoMessage', { number: so.orderNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.soService.deleteSalesOrder(so.id).subscribe({
        next: () => {
          this.changed.emit();
          this.closed.emit();
          this.snackbar.success(this.translate.instant('salesOrders.soDeleted'));
        },
      });
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Confirmed: 'chip--primary',
      InProduction: 'chip--info',
      PartiallyShipped: 'chip--warning',
      Shipped: 'chip--success',
      Completed: 'chip--success',
      Cancelled: 'chip--error',
      Pending: 'chip--muted',
      Packed: 'chip--info',
      InTransit: 'chip--warning',
      Delivered: 'chip--success',
      Received: 'chip--muted',
      UnderInspection: 'chip--info',
      ReworkOrdered: 'chip--warning',
      Resolved: 'chip--success',
      Closed: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'salesOrders.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected getPriorityClass(priority: string | null): string {
    const map: Record<string, string> = {
      Low: 'chip--muted',
      Normal: 'chip--info',
      High: 'chip--warning',
      Critical: 'chip--error',
    };
    return `chip ${map[priority ?? ''] ?? ''}`.trim();
  }

  protected isLineWarning(line: SalesOrderLine): boolean {
    return this.linesWithNoJobs().some(l => l.id === line.id);
  }

  protected canConfirm(status: string): boolean { return status === 'Draft'; }
  protected canCancel(status: string): boolean { return status === 'Draft' || status === 'Confirmed'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }
}
