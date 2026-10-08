import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';

import { OperationQuantityEntry } from '../../models/operation-quantity-entry.model';

/**
 * Quantities for one operation on a stepper, never a keyboard. Good pieces
 * start at everything not yet scrapped when the sheet opens from Done, and at
 * the recorded count otherwise; scrap stays folded away until asked for.
 * Counts are absolute. Going over the job quantity is flagged here because
 * the server refuses it.
 */
@Component({
  selector: 'app-operation-quantity-sheet',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './operation-quantity-sheet.component.html',
  styleUrl: './operation-quantity-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationQuantitySheetComponent {
  readonly label = input.required<string>();
  readonly jobQuantity = input.required<number>();
  readonly completed = input<number>(0);
  readonly scrap = input<number>(0);
  readonly finishing = input<boolean>(false);
  readonly busy = input<boolean>(false);
  readonly recorded = output<OperationQuantityEntry>();
  readonly cancelled = output<void>();

  protected readonly scrapCount = linkedSignal(() => this.scrap());
  protected readonly goodCount = linkedSignal(() =>
    this.finishing()
      ? Math.max(this.completed(), this.jobQuantity() - this.scrap())
      : this.completed());
  protected readonly scrapOpen = linkedSignal(() => this.scrap() > 0);
  protected readonly over = computed(() => this.goodCount() + this.scrapCount() > this.jobQuantity());

  protected bumpGood(delta: number): void {
    this.goodCount.update((n) => Math.max(0, n + delta));
  }

  protected bumpScrap(delta: number): void {
    this.scrapCount.update((n) => Math.max(0, n + delta));
  }

  protected openScrap(): void {
    this.scrapOpen.set(true);
  }

  protected submit(complete: boolean): void {
    if (this.over() || this.busy()) return;
    this.recorded.emit({ completed: this.goodCount(), scrap: this.scrapCount(), complete });
  }
}
