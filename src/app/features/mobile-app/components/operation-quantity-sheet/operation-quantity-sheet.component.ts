import {
  ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, input, linkedSignal, output, signal, viewChild,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslatePipe } from '@ngx-translate/core';

import { InputComponent } from '../../../../shared/components/input/input.component';
import { OperationReason } from '../../../../shared/models/operation-reason.model';
import { OperationQuantityEntry } from '../../models/operation-quantity-entry.model';

/**
 * Quantities for one operation on a stepper; the good count can also be
 * typed when it is too far to step to. Good pieces
 * start at everything not yet scrapped when the sheet opens from Done, and at
 * the recorded count otherwise; scrap and rework stay folded away until asked
 * for, and a reason is offered as chips once either is non-zero. Counts are
 * absolute except rework, which is this entry's pieces sent back. Going over
 * the job quantity is flagged here because the server refuses it.
 */
@Component({
  selector: 'app-operation-quantity-sheet',
  standalone: true,
  imports: [A11yModule, ReactiveFormsModule, TranslatePipe, InputComponent],
  templateUrl: './operation-quantity-sheet.component.html',
  styleUrl: './operation-quantity-sheet.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationQuantitySheetComponent {
  readonly label = input.required<string>();
  readonly jobQuantity = input.required<number>();
  readonly completed = input<number>(0);
  readonly scrap = input<number>(0);
  readonly reasons = input<OperationReason[]>([]);
  readonly finishing = input<boolean>(false);
  readonly busy = input<boolean>(false);
  readonly recorded = output<OperationQuantityEntry>();
  readonly cancelled = output<void>();

  protected readonly scrapCount = linkedSignal(() => this.scrap());
  protected readonly goodCount = linkedSignal(() =>
    this.finishing()
      ? Math.max(this.completed(), this.jobQuantity() - this.scrap())
      : this.completed());
  protected readonly reworkCount = signal(0);
  protected readonly reason = signal<string | null>(null);
  protected readonly scrapOpen = linkedSignal(() => this.scrap() > 0);
  protected readonly reworkOpen = signal(false);
  protected readonly over = computed(() => this.goodCount() + this.scrapCount() > this.jobQuantity());
  protected readonly askReason = computed(() =>
    this.reasons().length > 0 && (this.scrapCount() > this.scrap() || this.reworkCount() > 0));
  protected readonly typing = signal(false);
  protected readonly typedGood = new FormControl<number | null>(null);

  private readonly lastAction = viewChild<ElementRef<HTMLElement>>('lastAction');

  constructor() {
    this.typedGood.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      if (value !== null && Number.isFinite(value)) this.goodCount.set(Math.max(0, Math.floor(value)));
    });
    afterNextRender(() => this.lastAction()?.nativeElement.scrollIntoView?.({ block: 'nearest' }));
  }

  protected bumpGood(delta: number): void {
    this.goodCount.update((n) => Math.max(0, n + delta));
    if (this.typing()) this.typedGood.setValue(this.goodCount(), { emitEvent: false });
  }

  protected typeGood(): void {
    this.typedGood.setValue(this.goodCount(), { emitEvent: false });
    this.typing.set(true);
  }

  protected bumpScrap(delta: number): void {
    this.scrapCount.update((n) => Math.max(0, n + delta));
  }

  protected bumpRework(delta: number): void {
    this.reworkCount.update((n) => Math.max(0, n + delta));
  }

  protected openScrap(): void {
    this.scrapOpen.set(true);
  }

  protected openRework(): void {
    this.reworkOpen.set(true);
  }

  protected pickReason(code: string): void {
    this.reason.update((current) => (current === code ? null : code));
  }

  protected submit(complete: boolean): void {
    if (this.over() || this.busy()) return;
    this.recorded.emit({
      completed: this.goodCount(),
      scrap: this.scrapCount(),
      rework: this.reworkCount(),
      reason: this.askReason() ? this.reason() : null,
      complete,
    });
  }
}
