import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { CheckTierVarianceResult } from '../../models/tier-variance-check.model';
import { PriceOverrideReviewResponse } from '../../models/price-override-review.model';
import { PurchaseOrderService } from '../../services/purchase-order.service';
import { PoPriceReviewPanelComponent } from './po-price-review-panel.component';

interface PanelApi {
  ngOnInit(): void;
  review(): PriceOverrideReviewResponse | null;
  aiEnabled(): boolean;
  reasonControl: { setValue(v: string): void };
  acceptSuggestion(): void;
  useOwnReason(): void;
  reasonChosen: { emit(v: string): void };
}

const line: CheckTierVarianceResult = {
  partId: 9, quantity: 10, unitPrice: 13, vendorPartId: 4, tierPrice: 10, currency: 'USD', variancePct: 30, isOffTier: true, hasTier: true,
};

const aiReview: PriceOverrideReviewResponse = {
  tierPrice: 10, variancePct: 30, isOffTier: true, riskLevel: 'High',
  assessment: 'Looks risky.', suggestedJustification: 'Spot buy after a shortage.', aiAvailable: true,
};

describe('PoPriceReviewPanelComponent', () => {
  let reviewPriceOverride: ReturnType<typeof vi.fn>;

  function setup(aiOn: boolean): PanelApi {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: PurchaseOrderService, useValue: { reviewPriceOverride } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => aiOn && code === 'CAP-EXT-AI-ASSISTANT' } },
        { provide: TranslateService, useValue: { instant: (key: string) => key } },
      ],
    });
    const panel = TestBed.runInInjectionContext(() => new PoPriceReviewPanelComponent());
    mockSignalInputs(panel, { vendorId: 3, line, purchaseUnitId: 5, partNumber: 'BRK-1' });
    return panel as unknown as PanelApi;
  }

  beforeEach(() => {
    reviewPriceOverride = vi.fn(() => of(aiReview));
  });

  it('asks the AI review for the line when the assistant is on', () => {
    const panel = setup(true);

    panel.ngOnInit();

    expect(reviewPriceOverride).toHaveBeenCalledWith({
      vendorId: 3, partId: 9, quantity: 10, purchaseUnitId: 5, enteredUnitPrice: 13,
    });
    expect(panel.review()).toEqual(aiReview);
  });

  it('shows the standard review without calling the AI when the assistant is off', () => {
    const panel = setup(false);

    panel.ngOnInit();

    expect(reviewPriceOverride).not.toHaveBeenCalled();
    expect(panel.aiEnabled()).toBe(false);
    expect(panel.review()?.riskLevel).toBe('High');
    expect(panel.review()?.aiAvailable).toBe(false);
    expect(panel.review()?.suggestedJustification).toBe('purchaseOrders.priceReview.cannedJustification');
  });

  it('falls back to the standard review when the AI call fails', () => {
    reviewPriceOverride = vi.fn(() => throwError(() => new Error('503')));
    const panel = setup(true);

    panel.ngOnInit();

    expect(panel.review()?.aiAvailable).toBe(false);
  });

  it('accepts the suggested justification', () => {
    const panel = setup(true);
    const emit = vi.spyOn(panel.reasonChosen, 'emit');
    panel.ngOnInit();

    panel.acceptSuggestion();

    expect(emit).toHaveBeenCalledWith('Spot buy after a shortage.');
  });

  it('uses the buyer\'s own reason, and refuses a blank one', () => {
    const panel = setup(true);
    const emit = vi.spyOn(panel.reasonChosen, 'emit');
    panel.ngOnInit();

    panel.reasonControl.setValue('   ');
    panel.useOwnReason();
    expect(emit).not.toHaveBeenCalled();

    panel.reasonControl.setValue('  Vendor surcharge  ');
    panel.useOwnReason();
    expect(emit).toHaveBeenCalledWith('Vendor surcharge');
  });
});
