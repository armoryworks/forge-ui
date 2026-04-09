import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, CurrencyPipe } from '@angular/common';

import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { PaymentService } from '../../services/payment.service';
import { PaymentDetail } from '../../models/payment-detail.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { EntityActivitySectionComponent, ActivityFilterTab } from '../../../../shared/components/entity-activity-section/entity-activity-section.component';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { LoadingBlockDirective } from '../../../../shared/directives/loading-block.directive';

@Component({
  selector: 'app-payment-detail-panel',
  standalone: true,
  imports: [
    DatePipe, CurrencyPipe, TranslatePipe,
    MatTooltipModule, LoadingBlockDirective,
    EntityActivitySectionComponent,
  ],
  templateUrl: './payment-detail-panel.component.html',
  styleUrl: './payment-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDetailPanelComponent {
  private readonly paymentService = inject(PaymentService);
  private readonly dialog = inject(MatDialog);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);

  readonly paymentId = input.required<number>();
  readonly closed = output<void>();
  readonly paymentChanged = output<void>();

  protected readonly loading = signal(false);
  protected readonly payment = signal<PaymentDetail | null>(null);

  protected readonly paymentIdValue = computed(() => this.payment()?.id ?? 0);
  protected readonly activityTabs: ActivityFilterTab[] = ['history'];

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
    const key = 'payments.method' + method;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : method;
  }

  protected canDelete(): boolean {
    const payment = this.payment();
    return !!payment && payment.applications.length === 0;
  }

  protected deletePayment(): void {
    const payment = this.payment();
    if (!payment) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('payments.deletePaymentTitle'),
        message: this.translate.instant('payments.deletePaymentMessage', { number: payment.paymentNumber }),
        confirmLabel: this.translate.instant('common.delete'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.paymentService.deletePayment(payment.id).subscribe({
        next: () => {
          this.paymentChanged.emit();
          this.snackbar.success(this.translate.instant('payments.paymentDeleted'));
          this.closed.emit();
        },
      });
    });
  }

  private loadPayment(id: number): void {
    this.loading.set(true);
    this.paymentService.getPaymentById(id).subscribe({
      next: (detail) => {
        this.payment.set(detail);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
