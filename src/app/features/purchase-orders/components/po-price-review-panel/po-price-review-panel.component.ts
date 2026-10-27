import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { CapabilityService } from '../../../../shared/services/capability.service';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { TextareaComponent } from '../../../../shared/components/textarea/textarea.component';
import { CheckTierVarianceResult } from '../../models/tier-variance-check.model';
import { PriceOverrideReviewResponse } from '../../models/price-override-review.model';
import { PurchaseOrderService } from '../../services/purchase-order.service';

const AI_CAPABILITY = 'CAP-EXT-AI-ASSISTANT';
const HIGH_RISK_VARIANCE_PCT = 25;

@Component({
  selector: 'app-po-price-review-panel',
  standalone: true,
  imports: [DecimalPipe, ReactiveFormsModule, TranslatePipe, CurrencyDisplayComponent, TextareaComponent],
  templateUrl: './po-price-review-panel.component.html',
  styleUrl: './po-price-review-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoPriceReviewPanelComponent implements OnInit {
  private readonly purchaseOrders = inject(PurchaseOrderService);
  private readonly capabilities = inject(CapabilityService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly vendorId = input.required<number>();
  readonly line = input.required<CheckTierVarianceResult>();
  readonly purchaseUnitId = input<number | null>(null);
  readonly partNumber = input('');

  readonly reasonChosen = output<string>();
  readonly closed = output<void>();

  protected readonly loading = signal(false);
  protected readonly review = signal<PriceOverrideReviewResponse | null>(null);
  protected readonly aiEnabled = computed(() => this.capabilities.isEnabled(AI_CAPABILITY));
  protected readonly riskKey = computed(() => {
    switch (this.review()?.riskLevel) {
      case 'High': return 'purchaseOrders.priceReview.riskHigh';
      case 'Low': return 'purchaseOrders.priceReview.riskLow';
      default: return 'purchaseOrders.priceReview.riskMedium';
    }
  });

  protected readonly reasonControl = new FormControl<string>('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(500)],
  });

  ngOnInit(): void {
    if (!this.aiEnabled()) {
      this.review.set(this.cannedReview());
      return;
    }
    const line = this.line();
    this.loading.set(true);
    this.purchaseOrders.reviewPriceOverride({
      vendorId: this.vendorId(),
      partId: line.partId,
      quantity: line.quantity,
      purchaseUnitId: this.purchaseUnitId(),
      enteredUnitPrice: line.unitPrice,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (review) => { this.review.set(review); this.loading.set(false); },
      error: () => { this.review.set(this.cannedReview()); this.loading.set(false); },
    });
  }

  protected acceptSuggestion(): void {
    const suggestion = this.review()?.suggestedJustification.trim();
    if (suggestion) this.reasonChosen.emit(suggestion);
  }

  protected useOwnReason(): void {
    const reason = this.reasonControl.value.trim();
    if (!reason) {
      this.reasonControl.markAsTouched();
      return;
    }
    this.reasonChosen.emit(reason);
  }

  protected close(): void {
    this.closed.emit();
  }

  private cannedReview(): PriceOverrideReviewResponse {
    const line = this.line();
    const variance = line.variancePct;
    const riskLevel = variance !== null && variance > HIGH_RISK_VARIANCE_PCT ? 'High' : 'Medium';
    return {
      tierPrice: line.tierPrice,
      variancePct: variance,
      isOffTier: true,
      riskLevel,
      assessment: this.translate.instant(
        riskLevel === 'High' ? 'purchaseOrders.priceReview.cannedHigh' : 'purchaseOrders.priceReview.cannedMedium'),
      suggestedJustification: this.translate.instant('purchaseOrders.priceReview.cannedJustification', {
        entered: line.unitPrice,
        tier: line.tierPrice ?? '—',
        variance: variance === null ? '—' : variance.toFixed(1),
        qty: line.quantity,
      }),
      aiAvailable: false,
    };
  }
}
