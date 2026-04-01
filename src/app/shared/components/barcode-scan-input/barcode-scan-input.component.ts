import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, input, output, signal, ViewChild } from '@angular/core';

@Component({
  selector: 'app-barcode-scan-input',
  standalone: true,
  templateUrl: './barcode-scan-input.component.html',
  styleUrl: './barcode-scan-input.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BarcodeScanInputComponent implements AfterViewInit {
  readonly label = input('Scan Barcode');
  readonly placeholder = input('Scan or type barcode...');
  readonly autoFocus = input(false);
  readonly scanned = output<string>();

  @ViewChild('scanInput') scanInputRef!: ElementRef<HTMLInputElement>;

  ngAfterViewInit(): void {
    if (this.autoFocus()) {
      // setTimeout 0 defers past Angular's CD cycle so the element is in the DOM
      setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 0);
    }
  }

  protected readonly value = signal('');
  protected readonly isFocused = signal(false);

  private scanBuffer = '';
  private lastKeyTime = 0;
  private readonly SCAN_THRESHOLD_MS = 50;
  private readonly MIN_SCAN_LENGTH = 4;

  protected onKeydown(event: KeyboardEvent): void {
    const now = Date.now();

    if (event.key === 'Enter') {
      event.preventDefault();
      const val = this.value().trim();
      if (val.length >= this.MIN_SCAN_LENGTH) {
        this.scanned.emit(val);
        this.value.set('');
        this.scanBuffer = '';
      }
      return;
    }

    // Detect scanner vs keyboard: scanners type very fast (< 50ms between keys)
    if (event.key.length === 1) {
      if (now - this.lastKeyTime < this.SCAN_THRESHOLD_MS) {
        this.scanBuffer += event.key;
      } else {
        this.scanBuffer = event.key;
      }
      this.lastKeyTime = now;
    }
  }

  protected onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.value.set(input.value);
  }

  protected onFocus(): void {
    this.isFocused.set(true);
  }

  protected onBlur(): void {
    this.isFocused.set(false);
    // In autoFocus (kiosk) mode, re-focus unless another input intentionally took focus
    if (this.autoFocus()) {
      setTimeout(() => {
        const active = document.activeElement;
        const isOtherInput = active && active !== this.scanInputRef?.nativeElement
          && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable);
        if (!isOtherInput) {
          this.scanInputRef?.nativeElement?.focus();
        }
      }, 150);
    }
  }

  focus(): void {
    this.scanInputRef?.nativeElement?.focus();
  }

  clear(): void {
    this.value.set('');
    this.scanBuffer = '';
  }
}
