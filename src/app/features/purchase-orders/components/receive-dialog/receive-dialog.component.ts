import { ChangeDetectionStrategy, Component, inject, input, output, signal, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PurchaseOrderDetail } from '../../models/purchase-order-detail.model';
import { PurchaseOrderLine } from '../../models/purchase-order-line.model';
import { ReceiveLineRequest } from '../../models/receive-line-request.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-receive-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogComponent, EmptyStateComponent, TranslatePipe,
  ],
  templateUrl: './receive-dialog.component.html',
  styleUrl: './receive-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReceiveDialogComponent implements OnInit {
  private readonly poService = inject(PurchaseOrderService);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly purchaseOrder = input.required<PurchaseOrderDetail>();
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly saving = signal(false);
  protected readonly receivableLines = signal<PurchaseOrderLine[]>([]);
  protected readonly lineControls = signal<FormControl<number>[]>([]);

  ngOnInit(): void {
    const po = this.purchaseOrder();
    const lines = po.lines.filter(l => l.remainingQuantity > 0);
    this.receivableLines.set(lines);
    this.lineControls.set(
      lines.map(l => new FormControl<number>(0, {
        nonNullable: true,
        validators: [Validators.min(0), Validators.max(l.remainingQuantity)],
      }))
    );
  }

  protected get hasAnyQuantity(): boolean {
    return this.lineControls().some(c => (c.value ?? 0) > 0);
  }

  protected close(): void {
    this.closed.emit();
  }

  protected receiveAll(): void {
    const lines = this.receivableLines();
    const controls = this.lineControls();
    lines.forEach((l, i) => controls[i].setValue(l.remainingQuantity));
  }

  protected save(): void {
    const lines = this.receivableLines();
    const controls = this.lineControls();

    const receiveLines: ReceiveLineRequest[] = [];
    lines.forEach((l, i) => {
      const qty = controls[i].value ?? 0;
      if (qty > 0) {
        receiveLines.push({ lineId: l.id, quantity: qty });
      }
    });

    if (receiveLines.length === 0) return;

    this.saving.set(true);
    this.poService.receiveItems(this.purchaseOrder().id, { lines: receiveLines }).subscribe({
      next: () => {
        this.saving.set(false);
        this.snackbar.success(this.translate.instant('purchaseOrders.itemsReceived'));
        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }
}
