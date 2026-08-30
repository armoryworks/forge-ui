import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * Six-digit PIN pad sized for gloves: 72px keys, dots for entry, haptic-free
 * dumb component — the parent decides what a completed entry means.
 */
@Component({
  selector: 'app-pin-pad',
  standalone: true,
  imports: [],
  templateUrl: './pin-pad.component.html',
  styleUrl: './pin-pad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PinPadComponent {
  readonly length = input<number>(6);
  readonly completed = output<string>();

  protected readonly entry = signal('');
  protected readonly dots = computed(() =>
    Array.from({ length: this.length() }, (_, i) => i < this.entry().length));

  protected readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  protected press(digit: string): void {
    if (this.entry().length >= this.length()) return;
    const next = this.entry() + digit;
    this.entry.set(next);
    if (next.length === this.length()) {
      this.completed.emit(next);
      this.entry.set('');
    }
  }

  protected backspace(): void {
    this.entry.set(this.entry().slice(0, -1));
  }
}
