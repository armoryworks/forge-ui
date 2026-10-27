import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';

import { CheckTierVarianceResult } from '../../models/tier-variance-check.model';
import { DialogComponent } from '../../../../shared/components/dialog/dialog.component';
import { CurrencyDisplayComponent } from '../../../../shared/components/currency-display/currency-display.component';
import { PoPriceReviewPanelComponent } from '../po-price-review-panel/po-price-review-panel.component';

/**
 * Bought-parts effort PR4 — Off-tier price prompt at PO save time.
 *
 * Fires once per PO when one or more lines are flagged off-tier by the
 * server's `check-tier-variance` endpoint. Listed lines show the part,
 * the current tier price, the entered price, and the variance pct. Per
 * row, the buyer chooses:
 *
 *   - Default: record the line at the entered price as a one-off
 *     exception. Doesn't touch master pricing.
 *   - Update tier: insert a new VendorPartPriceTier with the entered
 *     price + line qty (effective today). Subsequent POs see the new
 *     baseline.
 *
 * Lines the vendor has no price for are never off-tier. They are listed
 * below the table with an opt-in action that saves the entered price as
 * the vendor's price for that part.
 *
 * Footer buttons: Cancel (returns to the PO dialog) / Continue (commits
 * the chosen action per row, then proceeds with PO submission).
 *
 * Per-row choice keeps the prompt explicit — defaulting to "exception"
 * means the buyer has to opt-in to tier changes, which avoids accidental
 * master-pricing pollution.
 */
@Component({
  selector: 'app-off-tier-prompt-dialog',
  standalone: true,
  imports: [
    DecimalPipe, TranslatePipe,
    DialogComponent, CurrencyDisplayComponent, PoPriceReviewPanelComponent,
  ],
  templateUrl: './off-tier-prompt-dialog.component.html',
  styleUrl: './off-tier-prompt-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OffTierPromptDialogComponent {
  readonly lines = input.required<CheckTierVarianceResult[]>();
  readonly thresholdPct = input.required<number>();
  /** Map of partNumber + description for display (key: partId). */
  readonly partLookup = input<Map<number, { partNumber: string; description: string }>>(new Map());
  /** Lines with no price on file for this vendor; each can opt in to saving its entered price. */
  readonly noTierLines = input<CheckTierVarianceResult[]>([]);
  /** The PO's vendor, for the per-line price review. */
  readonly vendorId = input<number | null>(null);
  /** Purchase option of each part line (key: partId), so the price review matches the right tier. */
  readonly purchaseUnitLookup = input<Map<number, number | null>>(new Map());

  /** User clicked Cancel — returns to the PO dialog without submitting. */
  readonly cancelled = output<void>();
  /** User clicked Continue — emits the per-row "update tier" and "save price" choice sets. */
  readonly confirmed = output<OffTierPromptResult>();

  /** Per-row "update tier" choice. Default false (one-off exception). */
  protected readonly updateTierByPart = signal<Record<number, boolean>>({});

  /** Per-line "save price" choice for the no-tier lines. Default false. */
  protected readonly savePriceByPart = signal<Record<number, boolean>>({});

  /** The off-tier line whose price review is open, if any. */
  protected readonly reviewingPartId = signal<number | null>(null);

  /** Per-line justification chosen in the price review (key: partId). */
  protected readonly reasonByPart = signal<Record<number, string>>({});

  protected readonly reviewingLine = computed(() => {
    const partId = this.reviewingPartId();
    return partId === null ? null : this.lines().find(l => l.partId === partId) ?? null;
  });

  protected readonly tierUpdateCount = computed(() =>
    Object.values(this.updateTierByPart()).filter(Boolean).length);

  protected toggleUpdateTier(partId: number): void {
    this.updateTierByPart.update(current => ({
      ...current,
      [partId]: !current[partId],
    }));
  }

  protected toggleSavePrice(partId: number): void {
    this.savePriceByPart.update(current => ({
      ...current,
      [partId]: !current[partId],
    }));
  }

  protected openReview(partId: number): void {
    this.reviewingPartId.set(this.reviewingPartId() === partId ? null : partId);
  }

  protected closeReview(): void {
    this.reviewingPartId.set(null);
  }

  protected chooseReason(partId: number, reason: string): void {
    this.reasonByPart.update(current => ({ ...current, [partId]: reason }));
    this.reviewingPartId.set(null);
  }

  protected partInfo(partId: number): { partNumber: string; description: string } {
    return this.partLookup().get(partId) ?? { partNumber: `#${partId}`, description: '' };
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected onConfirm(): void {
    const map = this.updateTierByPart();
    const updateTierLines = this.lines().filter(l => map[l.partId]);
    const saveMap = this.savePriceByPart();
    const savePriceLines = this.noTierLines().filter(l => saveMap[l.partId]);
    this.confirmed.emit({ updateTierLines, savePriceLines, reasonsByPart: this.reasonByPart() });
  }
}

/**
 * Emitted by Continue. Lines whose tier should be updated, no-tier lines whose price should be saved, and the
 * justification recorded for each reviewed off-tier line (key: partId).
 */
export interface OffTierPromptResult {
  updateTierLines: CheckTierVarianceResult[];
  savePriceLines: CheckTierVarianceResult[];
  reasonsByPart: Record<number, string>;
}
