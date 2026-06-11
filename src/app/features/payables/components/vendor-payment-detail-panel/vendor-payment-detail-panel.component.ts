import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorPaymentService } from '../../services/vendor-payment.service';
import { PaymentTransmissionService } from '../../services/payment-transmission.service';
import { VendorPaymentDetail } from '../../models/vendor-payment-detail.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

// ⚡ ACCOUNTING BOUNDARY — AP counterpart of PaymentDetailPanel.
@Component({
  selector: 'app-vendor-payment-detail-panel',
  standalone: true,
  imports: [
    DatePipe, TranslatePipe,
    MatTooltipModule, LoadingBlockDirective,
    EntityLinkComponent, CurrencyDisplayComponent,
  ],
  templateUrl: './vendor-payment-detail-panel.component.html',
  styleUrl: './vendor-payment-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorPaymentDetailPanelComponent {
  private readonly paymentService = inject(VendorPaymentService);
  private readonly transmissionService = inject(PaymentTransmissionService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly paymentId = input.required<number>();
  readonly closed = output<void>();

  protected readonly loading = signal(false);
  protected readonly payment = signal<VendorPaymentDetail | null>(null);

  /** Show the settlement FX column only when any application settled at a rate ≠ 1. */
  protected readonly showFxColumn = computed(() =>
    (this.payment()?.applications ?? []).some(a => a.settlementFxRate !== 1),
  );

  constructor() {
    effect(() => {
      const id = this.paymentId();
      if (id) {
        this.loadPayment(id);
      }
    });
  }

  protected close(): void {
    this.closed.emit();
  }

  protected getMethodLabel(method: string): string {
    const key = 'payables.method' + method;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : method;
  }

  protected getTransmissionChipClass(status: string): string {
    const map: Record<string, string> = {
      Queued: 'chip--info',
      Retrying: 'chip--warning',
      Succeeded: 'chip--success',
      Failed: 'chip--error',
      Cancelled: 'chip--muted',
    };
    return `chip ${map[status] ?? ''}`.trim();
  }

  protected getTransmissionStatusLabel(status: string): string {
    const key = 'payables.transmission.status' + status;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : status;
  }

  protected retryTransmission(): void {
    const payment = this.payment();
    if (!payment || payment.transmissionId === null) return;
    const transmissionId = payment.transmissionId;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('payables.transmission.retryTitle'),
        message: this.translate.instant('payables.transmission.retryMessage', { number: payment.paymentNumber }),
        confirmLabel: this.translate.instant('payables.transmission.retry'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // 409 (not Failed/Cancelled — e.g. retried elsewhere) surfaces via the
      // global error interceptor toast — only reload on success.
      this.transmissionService.retryPaymentTransmission(transmissionId).subscribe({
        next: () => {
          this.loadPayment(payment.id);
          this.snackbar.success(this.translate.instant('payables.transmission.retryQueued'));
        },
      });
    });
  }

  private loadPayment(id: number): void {
    this.loading.set(true);
    this.paymentService.getVendorPaymentById(id).subscribe({
      next: (detail) => {
        this.payment.set(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
