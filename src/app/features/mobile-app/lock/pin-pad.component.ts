import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { TranslatePipe, TranslateService } from '@ngx-translate/core';

/**
 * PIN pad sized for gloves: 72px keys, dots for entry, haptic-free dumb
 * component — the parent decides what a completed entry means. By default it
 * takes a fixed `length` and submits on the last digit; give it `maxLength`
 * for a variable-length PIN that submits on the OK key once `minLength` digits
 * are in. Digits, Backspace and Enter on a hardware keyboard work too, and
 * each change is announced as a count, never the digits. Enter on a focused
 * button or link activates that control rather than submitting.
 */
@Component({
  selector: 'app-pin-pad',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './pin-pad.component.html',
  styleUrl: './pin-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown)': 'onKey($event)' },
})
export class PinPadComponent {
  private readonly announcer = inject(LiveAnnouncer);
  private readonly translate = inject(TranslateService);

  readonly length = input<number>(6);
  readonly minLength = input<number | null>(null);
  readonly maxLength = input<number | null>(null);
  readonly completed = output<string>();

  protected readonly entry = signal('');

  protected readonly variable = computed(() => this.maxLength() !== null);
  private readonly limit = computed(() => this.maxLength() ?? this.length());
  private readonly minimum = computed(() => Math.min(this.minLength() ?? this.limit(), this.limit()));
  protected readonly canSubmit = computed(() => this.entry().length >= this.minimum());

  protected readonly dots = computed(() => {
    const slots = this.variable()
      ? Math.max(this.minimum(), this.entry().length)
      : this.length();
    return Array.from({ length: slots }, (_, i) => i < this.entry().length);
  });

  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  protected press(digit: string): void {
    if (this.entry().length >= this.limit()) return;
    const next = this.entry() + digit;
    this.entry.set(next);
    if (!this.variable() && next.length === this.length()) {
      this.emit(next);
      return;
    }
    this.announce();
  }

  protected backspace(): void {
    this.entry.set(this.entry().slice(0, -1));
    this.announce();
  }

  protected onKey(event: KeyboardEvent): void {
    const target = event.target;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (event.key === 'Enter' && target instanceof Element && target.closest('button, a[href]')) return;
    if (/^\d$/.test(event.key)) this.press(event.key);
    else if (event.key === 'Backspace') this.backspace();
    else if (event.key === 'Enter') this.submit();
    else return;
    event.preventDefault();
  }

  private announce(): void {
    void this.announcer.announce(this.translate.instant('mobileApp.lock.digitsEntered', {
      count: this.entry().length, total: this.limit(),
    }));
  }

  protected submit(): void {
    if (!this.variable() || !this.canSubmit()) return;
    this.emit(this.entry());
  }

  private emit(pin: string): void {
    this.completed.emit(pin);
    this.entry.set('');
  }
}
