import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorBillService } from '../../services/vendor-bill.service';
import { VendorBillDetail } from '../../models/vendor-bill-detail.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityActivitySectionComponent } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of InvoiceDetailPanel.
@Component({
  selector: 'app-vendor-bill-detail-panel',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, TranslatePipe,
    MatTooltipModule, LoadingBlockDirective,
    EntityActivitySectionComponent, EntityLinkComponent, CurrencyDisplayComponent,
  ],
  templateUrl: './vendor-bill-detail-panel.component.html',
  styleUrl: './vendor-bill-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorBillDetailPanelComponent {
  private readonly billService = inject(VendorBillService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly billId = input.required<number>();
  readonly closed = output<void>();
  readonly billChanged = output<void>();

  protected readonly loading = signal(false);
  protected readonly bill = signal<VendorBillDetail | null>(null);

  constructor() {
    effect(() => {
      const id = this.billId();
      if (id) {
        this.loadBill(id);
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected canApprove(bill: VendorBillDetail): boolean {
    return bill.status === 'Draft';
  }

  protected canVoid(bill: VendorBillDetail): boolean {
    // A bill promoted from an expense is voided by rejecting / revising the EXPENSE (the server
    // rejects a direct void) — hide the button so the lifecycle has one driver.
    return (bill.status === 'Draft' || bill.status === 'Approved')
      && bill.amountPaid === 0
      && bill.sourceExpenseId === null;
  }

  protected approveBill(): void {
    const bill = this.bill();
    if (!bill) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('payables.approveBillTitle'),
        message: this.translate.instant('payables.approveBillMessage', { number: bill.billNumber }),
        confirmLabel: this.translate.instant('payables.approve'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // 409s (3-way-match over-bill guard) surface via the global error
      // interceptor toast — only reload on success.
      this.billService.approveVendorBill(bill.id).subscribe({
        next: () => {
          this.loadBill(bill.id);
          this.billChanged.emit();
          this.snackbar.success(this.translate.instant('payables.billApproved'));
        },
      });
    });
  }

  protected voidBill(): void {
    const bill = this.bill();
    if (!bill) return;
    const isDraft = bill.status === 'Draft';
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('payables.voidBillTitle'),
        message: this.translate.instant(
          isDraft ? 'payables.voidDraftBillMessage' : 'payables.voidApprovedBillMessage',
          { number: bill.billNumber },
        ),
        confirmLabel: this.translate.instant('payables.void'),
        severity: isDraft ? 'warn' : 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.billService.voidVendorBill(bill.id).subscribe({
        next: () => {
          this.loadBill(bill.id);
          this.billChanged.emit();
          this.snackbar.success(this.translate.instant('payables.billVoided'));
        },
      });
    });
  }

  protected getStatusClass(status: string): string {
    const map: Record<string, string> = {
      Draft: 'chip--info',
      Approved: 'chip--primary',
      PartiallyPaid: 'chip--warning',
      Paid: 'chip--success',
      Void: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getStatusLabel(status: string): string {
    const key = 'payables.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  private loadBill(id: number): void {
    this.loading.set(true);
    this.billService.getVendorBillById(id).subscribe({
      next: (detail) => {
        this.bill.set(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
