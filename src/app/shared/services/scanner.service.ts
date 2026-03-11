import { Injectable, signal, computed, NgZone, inject, OnDestroy } from '@angular/core';

import { ScanEvent, ScanContext } from '../models/scan-event.model';

@Injectable({ providedIn: 'root' })
export class ScannerService implements OnDestroy {
  private readonly zone = inject(NgZone);

  private readonly SCAN_THRESHOLD_MS = 50;
  private readonly SCAN_COMPLETE_DELAY_MS = 80;
  private readonly MIN_SCAN_LENGTH = 4;

  private buffer = '';
  private lastKeyTime = 0;
  private completeTimer: ReturnType<typeof setTimeout> | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;

  private readonly _context = signal<ScanContext>('global');
  private readonly _lastScan = signal<ScanEvent | null>(null);
  private readonly _enabled = signal(true);
  private readonly _listening = signal(false);

  readonly context = this._context.asReadonly();
  readonly lastScan = this._lastScan.asReadonly();
  readonly enabled = this._enabled.asReadonly();
  readonly listening = this._listening.asReadonly();
  readonly hasRecentScan = computed(() => {
    const scan = this._lastScan();
    if (!scan) return false;
    return Date.now() - scan.timestamp.getTime() < 5000;
  });

  start(): void {
    if (this._listening()) return;

    this.keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);

    this.zone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.keydownHandler!, { capture: true });
    });

    this._listening.set(true);
  }

  stop(): void {
    if (!this._listening()) return;

    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler, { capture: true });
      this.keydownHandler = null;
    }

    this.clearBuffer();
    this._listening.set(false);
  }

  setContext(context: ScanContext): void {
    this._context.set(context);
  }

  enable(): void {
    this._enabled.set(true);
  }

  disable(): void {
    this._enabled.set(false);
    this.clearBuffer();
  }

  clearLastScan(): void {
    this._lastScan.set(null);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private onKeydown(event: KeyboardEvent): void {
    if (!this._enabled()) return;

    // Skip if user is typing in a focused input/textarea/select
    const target = event.target as HTMLElement;
    if (this.isEditableElement(target)) {
      // Exception: barcode-scan-input handles its own scanning
      if (target.closest('app-barcode-scan-input')) return;

      // Allow scanning in regular inputs only if the keystroke timing matches scanner speed
      const now = Date.now();
      if (event.key.length === 1 && now - this.lastKeyTime > this.SCAN_THRESHOLD_MS) {
        // Too slow — this is normal typing, not a scanner
        return;
      }
    }

    const now = Date.now();

    if (event.key === 'Enter') {
      if (this.buffer.length >= this.MIN_SCAN_LENGTH) {
        this.emitScan(this.buffer);
        event.preventDefault();
        event.stopPropagation();
      }
      this.clearBuffer();
      return;
    }

    // Only accumulate printable characters
    if (event.key.length !== 1) return;

    if (now - this.lastKeyTime < this.SCAN_THRESHOLD_MS) {
      this.buffer += event.key;
    } else {
      this.buffer = event.key;
    }
    this.lastKeyTime = now;

    // Auto-complete scan after brief pause (scanner sends Enter, but as a fallback)
    if (this.completeTimer) clearTimeout(this.completeTimer);
    this.completeTimer = setTimeout(() => {
      if (this.buffer.length >= this.MIN_SCAN_LENGTH) {
        this.emitScan(this.buffer);
      }
      this.clearBuffer();
    }, this.SCAN_COMPLETE_DELAY_MS);
  }

  private emitScan(value: string): void {
    const scanEvent: ScanEvent = {
      value: value.trim(),
      timestamp: new Date(),
      context: this._context(),
    };

    this.zone.run(() => {
      this._lastScan.set(scanEvent);
    });
  }

  private clearBuffer(): void {
    this.buffer = '';
    this.lastKeyTime = 0;
    if (this.completeTimer) {
      clearTimeout(this.completeTimer);
      this.completeTimer = null;
    }
  }

  private isEditableElement(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    if (tag === 'input') {
      const type = (el as HTMLInputElement).type;
      return ['text', 'search', 'number', 'email', 'password', 'tel', 'url'].includes(type);
    }
    return tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
}
