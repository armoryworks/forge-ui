import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal, computed } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderRelease, CreatePurchaseOrderReleaseRequest } from '../../models/purchase-order-release.model';
import { ReceiveDialogComponent } from '../receive-dialog/receive-dialog.component';
import { BarcodeInfoComponent } from '../../../../shared/components/barcode-info/barcode-info.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { InputComponent } from '../../../../shared/components/input/input.component';
import { SelectComponent, SelectOption } from '../../../../shared/components/select/select.component';
import { DatepickerComponent } from '../../../../shared/components/datepicker/datepicker.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { ValidationPopoverDirective } from '../../../../shared/directives/validation-popover.directive';
import { toIsoDate } from '../../../../shared/utils/date.utils';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';

@Component({
  selector: 'app-po-detail-panel',
  standalone: true,
  imports: [
    DatePipe, CurrencyPipe, TranslatePipe, ReactiveFormsModule,
    MatTooltipModule,
    BarcodeInfoComponent, EntityActivitySectionComponent,
    ReceiveDialogComponent, LoadingBlockDirective,
    DialogComponent, InputComponent, SelectComponent, DatepickerComponent, TextareaComponent,
    ValidationPopoverDirective,
    EntityLinkComponent,
    DataTableComponent, ColumnCellDirective,
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
  protected readonly releases = signal<PurchaseOrderRelease[]>([]);
  protected readonly showCreateReleaseDialog = signal(false);
  protected readonly releaseSaving = signal(false);

  protected readonly releaseColumns: ColumnDef[] = [
    { field: 'releaseNumber', header: '#', sortable: true, width: '60px' },
    { field: 'partNumber', header: 'Part', sortable: true, width: '120px' },
    { field: 'quantity', header: 'Qty', sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'requestedDeliveryDate', header: 'Req. Delivery', sortable: true, type: 'date', width: '120px' },
    { field: 'status', header: 'Status', sortable: true, width: '110px' },
  ];

  ngOnInit(): void {
    this.loadDetail();
  }

  protected loadDetail(): void {
    this.loading.set(true);
    this.poService.getPurchaseOrderById(this.purchaseOrderId()).subscribe({
      next: (detail) => {
        this.po.set(detail);
        this.loading.set(false);
        if (detail.isBlanket) this.loadReleases();
      },
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

  // --- Releases ---
  protected readonly lineOptions = computed<SelectOption[]>(() => {
    const po = this.po();
    if (!po) return [];
    return po.lines.map(l => ({ value: l.id, label: `${l.partNumber} — ${l.description}` }));
  });

  protected readonly releaseForm = new FormGroup({
    purchaseOrderLineId: new FormControl<number | null>(null, [Validators.required]),
    quantity: new FormControl<number | null>(null, [Validators.required, Validators.min(0.01)]),
    requestedDeliveryDate: new FormControl<Date | null>(null, [Validators.required]),
    notes: new FormControl(''),
  });

  protected readonly releaseViolations = FormValidationService.getViolations(this.releaseForm, {
    purchaseOrderLineId: 'Line Item',
    quantity: 'Quantity',
    requestedDeliveryDate: 'Delivery Date',
  });

  protected loadReleases(): void {
    const po = this.po();
    if (!po?.isBlanket) return;
    this.poService.getReleases(po.id).subscribe({
      next: (data) => this.releases.set(data),
    });
  }

  protected openCreateRelease(): void {
    this.releaseForm.reset();
    this.showCreateReleaseDialog.set(true);
  }

  protected saveRelease(): void {
    const po = this.po();
    if (!po || this.releaseForm.invalid) return;
    this.releaseSaving.set(true);
    const form = this.releaseForm.getRawValue();
    const request: CreatePurchaseOrderReleaseRequest = {
      purchaseOrderLineId: form.purchaseOrderLineId!,
      quantity: form.quantity!,
      requestedDeliveryDate: toIsoDate(form.requestedDeliveryDate!)!,
      notes: form.notes || undefined,
    };
    this.poService.createRelease(po.id, request).subscribe({
      next: () => {
        this.snackbar.success('Release created');
        this.showCreateReleaseDialog.set(false);
        this.releaseSaving.set(false);
        this.loadReleases();
        this.loadDetail();
        this.changed.emit();
      },
      error: () => this.releaseSaving.set(false),
    });
  }

  protected getReleaseStatusClass(status: string): string {
    const map: Record<string, string> = {
      Open: 'chip--info',
      Sent: 'chip--primary',
      PartialReceived: 'chip--warning',
      Received: 'chip--success',
      Cancelled: 'chip--error',
    };
    return `chip ${map[status] ?? ''}`.trim();
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
