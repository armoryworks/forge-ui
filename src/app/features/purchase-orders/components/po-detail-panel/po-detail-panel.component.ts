import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { ReceiveDialogComponent } from '../receive-dialog/receive-dialog.component';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-po-detail-panel',
  standalone: true,
  imports: [
    DatePipe, CurrencyPipe, TranslatePipe,
    MatTooltipModule,
    BarcodeInfoComponent, EntityActivitySectionComponent,
    ReceiveDialogComponent, LoadingBlockDirective,
  ],
  templateUrl: './po-detail-panel.component.html',
  styleUrl: './po-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoDetailPanelComponent implements OnInit {
  private readonly poService = inject(PurchaseOrderService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly purchaseOrderId = input.required<number>();
  readonly closed = output<void>();
  readonly changed = output<void>();

  protected readonly po = signal<PurchaseOrderDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly showReceiveDialog = signal(false);

  ngOnInit(): void {
    this.loadDetail();
  }

  protected loadDetail(): void {
    this.loading.set(true);
    this.poService.getPurchaseOrderById(this.purchaseOrderId()).subscribe({
      next: (detail) => { this.po.set(detail); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  // --- Receive ---
  protected openReceiveDialog(): void { this.showReceiveDialog.set(true); }
  protected closeReceiveDialog(): void { this.showReceiveDialog.set(false); }

  protected onReceiveSaved(): void {
    this.closeReceiveDialog();
    this.loadDetail();
    this.changed.emit();
  }

  // --- Status Actions ---
  protected submitPo(): void {
    const po = this.po();
    if (!po) return;
    this.poService.submitPurchaseOrder(po.id).subscribe({
      next: () => {
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poSubmitted'));
      },
    });
  }

  protected acknowledgePo(): void {
    const po = this.po();
    if (!po) return;
    this.poService.acknowledgePurchaseOrder(po.id).subscribe({
      next: () => {
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poAcknowledged'));
      },
    });
  }

  protected cancelPo(): void {
    const po = this.po();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('purchaseOrders.cancelPoTitle'),
        message: this.translate.instant('purchaseOrders.cancelPoMessage', { number: po.poNumber }),
        confirmLabel: this.translate.instant('purchaseOrders.cancelPo'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.cancelPurchaseOrder(po.id).subscribe({
        next: () => {
          this.loadDetail();
          this.changed.emit();
          this.snackbar.success(this.translate.instant('purchaseOrders.poCancelled'));
        },
      });
    });
  }

  protected closePo(): void {
    const po = this.po();
    if (!po) return;
    this.poService.closePurchaseOrder(po.id).subscribe({
      next: () => {
        this.loadDetail();
        this.changed.emit();
        this.snackbar.success(this.translate.instant('purchaseOrders.poClosed'));
      },
    });
  }

  protected deletePo(): void {
    const po = this.po();
    if (!po) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('purchaseOrders.deletePoTitle'),
        message: this.translate.instant('purchaseOrders.deletePoMessage', { number: po.poNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.poService.deletePurchaseOrder(po.id).subscribe({
        next: () => {
          this.changed.emit();
          this.closed.emit();
          this.snackbar.success(this.translate.instant('purchaseOrders.poDeleted'));
        },
      });
    });
  }

  // --- Helpers ---
  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--muted',
      Submitted: 'chip--info',
      Acknowledged: 'chip--primary',
      PartiallyReceived: 'chip--warning',
      Received: 'chip--success',
      Closed: 'chip--muted',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'purchaseOrders.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected canSubmit(status: string): boolean { return status === 'Draft'; }
  protected canAcknowledge(status: string): boolean { return status === 'Submitted'; }
  protected canReceive(status: string): boolean {
    return status === 'Acknowledged' || status === 'PartiallyReceived';
  }
  protected canCancel(status: string): boolean {
    return status === 'Draft' || status === 'Submitted' || status === 'Acknowledged';
  }
  protected canClose(status: string): boolean { return status === 'Received'; }
  protected canDelete(status: string): boolean { return status === 'Draft'; }
}
