import { describe, it, expect, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { CheckTierVarianceResult } from '../../models/tier-variance-check.model';
import { OffTierPromptDialogComponent, OffTierPromptResult } from './off-tier-prompt-dialog.component';

interface PromptApi {
  openReview(partId: number): void;
  closeReview(): void;
  chooseReason(partId: number, reason: string): void;
  reviewingLine(): CheckTierVarianceResult | null;
  onConfirm(): void;
  confirmed: { emit(v: OffTierPromptResult): void };
}

const offTier = (partId: number): CheckTierVarianceResult => ({
  partId, quantity: 5, unitPrice: 12, vendorPartId: partId, tierPrice: 10, currency: 'USD', variancePct: 20, isOffTier: true, hasTier: true,
});

function setup(): PromptApi {
  TestBed.resetTestingModule();
  const prompt = TestBed.runInInjectionContext(() => new OffTierPromptDialogComponent());
  mockSignalInputs(prompt, { lines: [offTier(1), offTier(2)], thresholdPct: 5, noTierLines: [], vendorId: 3 });
  return prompt as unknown as PromptApi;
}

describe('OffTierPromptDialogComponent · price review', () => {
  it('opens and closes the review for one line at a time', () => {
    const prompt = setup();

    prompt.openReview(2);
    expect(prompt.reviewingLine()?.partId).toBe(2);

    prompt.openReview(2);
    expect(prompt.reviewingLine()).toBeNull();

    prompt.openReview(1);
    prompt.closeReview();
    expect(prompt.reviewingLine()).toBeNull();
  });

  it('sends the chosen justification with Continue', () => {
    const prompt = setup();
    const emit = vi.spyOn(prompt.confirmed, 'emit');

    prompt.openReview(1);
    prompt.chooseReason(1, 'Spot buy after a shortage.');
    prompt.onConfirm();

    expect(prompt.reviewingLine()).toBeNull();
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ reasonsByPart: { 1: 'Spot buy after a shortage.' } }));
  });
});
