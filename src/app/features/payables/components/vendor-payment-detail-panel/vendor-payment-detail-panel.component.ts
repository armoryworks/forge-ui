import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { VendorPaymentService } from '../../services/vendor-payment.service';
import { VendorPaymentDetail } from '../../models/vendor-payment-detail.model';
import { EntityLinkComponent } from '../../../../shared/components/entity-link/entity-link.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
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
