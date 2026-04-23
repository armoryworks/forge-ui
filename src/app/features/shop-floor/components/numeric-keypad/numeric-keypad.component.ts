import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export type KeypadMode = 'auto' | 'always' | 'never';

const KEYPAD_MODE_KEY = 'sf-keypad-mode';

function detectTouch(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const touchPoints = navigator.maxTouchPoints ?? 0;
  return coarse || touchPoints > 0;
}

function readMode(): KeypadMode {
  const stored = localStorage.getItem(KEYPAD_MODE_KEY);
  if (stored === 'always' || stored === 'never' || stored === 'auto') return stored;
  return 'auto';
}

@Component({
  selector: 'app-numeric-keypad',
  standalone: true,
  templateUrl: './numeric-keypad.component.html',
  styleUrl: './numeric-keypad.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumericKeypadComponent {
  readonly disabled = input(false);

  readonly digit = output<string>();
  readonly backspace = output<void>();
  readonly clear = output<void>();

  private readonly mode = signal<KeypadMode>(readMode());
  private readonly isTouch = signal(detectTouch());

  protected readonly visible = computed(() => {
    const m = this.mode();
    if (m === 'always') return true;
    if (m === 'never') return false;
    return this.isTouch();
  });

  protected readonly topRows: readonly (readonly string[])[] = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
  ];

  protected onDigit(value: string): void {
    if (this.disabled()) return;
    this.digit.emit(value);
  }

  protected onBackspace(): void {
    if (this.disabled()) return;
    this.backspace.emit();
  }

  protected onClear(): void {
    if (this.disabled()) return;
    this.clear.emit();
  }

  protected cycleMode(): void {
    const next: KeypadMode = this.mode() === 'auto' ? 'always' : this.mode() === 'always' ? 'never' : 'auto';
    this.mode.set(next);
    localStorage.setItem(KEYPAD_MODE_KEY, next);
  }

  protected modeLabel(): string {
    const m = this.mode();
    if (m === 'always') return 'Keypad: Always';
    if (m === 'never') return 'Keypad: Off';
    return this.isTouch() ? 'Keypad: Auto (on)' : 'Keypad: Auto (off)';
  }
}
