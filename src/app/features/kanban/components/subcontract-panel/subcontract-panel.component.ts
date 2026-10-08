import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { DataTableComponent } from '../../../../shared/components/data-table/data-table.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { ColumnCellDirective } from '../../../../shared/directives/column-cell.directive';
import { ColumnDef } from '../../../../shared/models/column-def.model';
import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { SubcontractOperation } from '../../models/subcontract-operation.model';
import { SubcontractOrder } from '../../models/subcontract-order.model';
import { SubcontractReceiveBackDialogData } from '../../models/subcontract-receive-back-dialog-data.model';
import { SubcontractSendOutDialogData } from '../../models/subcontract-send-out-dialog-data.model';
import { SubcontractStatus } from '../../models/subcontract-status.type';
import { SubcontractService } from '../../services/subcontract.service';
import { SubcontractReceiveBackDialogComponent } from '../subcontract-receive-back-dialog/subcontract-receive-back-dialog.component';
import { SubcontractSendOutDialogComponent } from '../subcontract-send-out-dialog/subcontract-send-out-dialog.component';

const SUBCONTRACT_CAPABILITY = 'CAP-P2P-SUBCONTRACT';
const SUBCONTRACT_ROLES = ['Admin', 'Manager', 'Engineer', 'PM'];
const OPEN_STATUSES: readonly SubcontractStatus[] = ['Pending', 'Sent', 'InProcess', 'Shipped', 'Received', 'QcPending'];

const STATUS_LABEL_KEYS: Record<SubcontractStatus, string> = {
  Pending: 'subcontractUi.status.pending',
  Sent: 'subcontractUi.status.sent',
  InProcess: 'subcontractUi.status.inProcess',
  Shipped: 'subcontractUi.status.shipped',
  Received: 'subcontractUi.status.received',
  QcPending: 'subcontractUi.status.qcPending',
  Complete: 'subcontractUi.status.complete',
  Rejected: 'subcontractUi.status.rejected',
};

const STATUS_CHIP_CLASSES: Record<SubcontractStatus, string> = {
  Pending: 'chip chip--muted',
  Sent: 'chip chip--info',
  InProcess: 'chip chip--info',
  Shipped: 'chip chip--info',
  Received: 'chip chip--warning',
  QcPending: 'chip chip--warning',
  Complete: 'chip chip--success',
  Rejected: 'chip chip--error',
};

@Component({
  selector: 'app-subcontract-panel',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe, DataTableComponent, EntityLinkComponent, ColumnCellDirective],
  templateUrl: './subcontract-panel.component.html',
  styleUrl: './subcontract-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubcontractPanelComponent {
  readonly jobId = input.required<number>();

  private readonly subcontractService = inject(SubcontractService);
  private readonly capabilities = inject(CapabilityService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly enabled = computed(() =>
    this.capabilities.isEnabled(SUBCONTRACT_CAPABILITY) && this.auth.hasAnyRole(SUBCONTRACT_ROLES));
  readonly operations = signal<SubcontractOperation[]>([]);
  readonly orders = signal<SubcontractOrder[]>([]);
  readonly visible = computed(() => this.enabled() && (this.operations().length > 0 || this.orders().length > 0));

  readonly orderColumns: ColumnDef[] = [
    { field: 'operationName', header: this.translate.instant('subcontractUi.operation'), sortable: true },
    { field: 'vendorName', header: this.translate.instant('subcontractUi.vendor'), sortable: true },
    { field: 'quantity', header: this.translate.instant('subcontractUi.quantity'), sortable: true, type: 'number', width: '80px', align: 'right' },
    { field: 'sentAt', header: this.translate.instant('subcontractUi.sentOn'), sortable: true, type: 'date', width: '100px' },
    { field: 'expectedReturnDate', header: this.translate.instant('subcontractUi.expectedReturn'), sortable: true, type: 'date', width: '110px' },
    { field: 'status', header: this.translate.instant('subcontractUi.statusHeader'), sortable: true, width: '110px' },
    { field: 'receivedQuantity', header: this.translate.instant('subcontractUi.goodBack'), type: 'number', width: '80px', align: 'right' },
    { field: 'poNumber', header: this.translate.instant('subcontractUi.purchaseOrder'), width: '110px' },
    { field: 'actions', header: '', width: '130px', align: 'right' },
  ];

  constructor() {
    effect(() => {
      const jobId = this.jobId();
      if (jobId && this.enabled()) untracked(() => this.load(jobId));
    });
  }

  isOpen(order: SubcontractOrder): boolean {
    return OPEN_STATUSES.includes(order.status);
  }

  outQuantity(operation: SubcontractOperation): number {
    return this.orders()
      .filter(order => order.operationId === operation.operationId && this.isOpen(order))
      .reduce((sum, order) => sum + order.quantity, 0);
  }

  oldestOpenOrder(operation: SubcontractOperation): SubcontractOrder | null {
    return this.orders()
      .filter(order => order.operationId === operation.operationId && this.isOpen(order))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt))[0] ?? null;
  }

  statusLabelKey(status: SubcontractStatus): string {
    return STATUS_LABEL_KEYS[status] ?? status;
  }

  statusChipClass(status: SubcontractStatus): string {
    return STATUS_CHIP_CLASSES[status] ?? 'chip';
  }

  sendOut(operation: SubcontractOperation): void {
    const alreadySent = this.orders()
      .filter(order => order.operationId === operation.operationId && order.status !== 'Rejected')
      .reduce((sum, order) => sum + order.quantity, 0);
    const remaining = operation.jobQuantity - alreadySent;
    const data: SubcontractSendOutDialogData = {
      jobId: this.jobId(),
      operation,
      defaultQuantity: remaining > 0 ? remaining : operation.jobQuantity,
    };
    this.dialog.open(SubcontractSendOutDialogComponent, { data, width: '480px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(order => {
        if (order) this.load(this.jobId());
      });
  }

  receiveBack(order: SubcontractOrder): void {
    const data: SubcontractReceiveBackDialogData = { order };
    this.dialog.open(SubcontractReceiveBackDialogComponent, { data, width: '440px' })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(received => {
        if (received) this.load(this.jobId());
      });
  }

  private load(jobId: number): void {
    forkJoin({
      operations: this.subcontractService.getOperations(jobId),
      orders: this.subcontractService.getOrders(jobId),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ operations, orders }) => {
        this.operations.set(operations);
        this.orders.set(orders);
      },
      error: () => {
        this.operations.set([]);
        this.orders.set([]);
      },
    });
  }
}
