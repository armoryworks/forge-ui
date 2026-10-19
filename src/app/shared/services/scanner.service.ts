import { Injectable, signal, computed, NgZone, inject, OnDestroy, effect } from '@angular/core';

import { ScanEvent, ScanContext } from '../models/scan-event.model';
import { WebHidRfidService } from './web-hid-rfid.service';

@Injectable({ providedIn: 'root' })
export class ScannerService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private readonly rfid = inject(WebHidRfidService);

  private readonly SCAN_THRESHOLD_MS = 50;
  private readonly SCAN_COMPLETE_DELAY_MS = 80;
  private readonly STALL_TOLERANCE_MS = 40;
  private readonly MIN_SCAN_LENGTH = 4;

  private buffer = '';
  private firstKeyTime = 0;
  private lastKeyTime = 0;
  private completeTimer: ReturnType<typeof setTimeout> | null = null;
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private rfidConnected = false;

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

  // Bridge RFID relay scans into the unified scan signal
  private readonly rfidBridge = effect(() => {
    const rfidScan = this.rfid.lastScan();
    if (!rfidScan || !this._listening() || !this._enabled()) return;
    this.rfid.clearLastScan();
    this._lastScan.set({
      value: rfidScan.uid,
      timestamp: rfidScan.timestamp,
      context: this._context(),
    });
  });

  start(): void {
    if (this._listening()) return;

    this.keydownHandler = (e: KeyboardEvent) => this.onKeydown(e);

    this.zone.runOutsideAngular(() => {
      document.addEventListener('keydown', this.keydownHandler!, { capture: true });
    });

    this._listening.set(true);

    // Auto-connect to RFID relay WebSocket (silent, no error if relay isn't running)
    if (!this.rfidConnected) {
      this.rfid.reconnect().then((connected) => {
        this.rfidConnected = connected;
      });
    }
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

  /**
   * Force-restart the scanner. Removes any existing listener and re-registers.
   * Use on pages that manage their own scanner lifecycle (e.g., shop floor kiosk)
   * to guarantee the listener is active regardless of prior state.
   */
  restart(): void {
    // Tear down unconditionally
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler, { capture: true });
      this.keydownHandler = null;
    }
    this.clearBuffer();
    this._listening.set(false);

    // Re-register
    this.start();
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

  submit(value: string): void {
    if (!this._enabled() || !value.trim()) return;
    this.emitScan(value);
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private onKeydown(event: KeyboardEvent): void {
    if (!this._enabled()) return;

    const target = event.target;
    if (target instanceof HTMLElement && this.isEditableElement(target) && !target.closest('app-barcode-scan-input')) {
      this.clearBuffer();
      return;
    }

    const now = this.eventTime(event);

    if (event.key === 'Enter') {
      if (this.isScanBurst()) {
        this.emitScan(this.buffer);
        event.preventDefault();
        event.stopPropagation();
      }
      this.clearBuffer();
      return;
    }

    // Only accumulate printable characters
    if (event.key.length !== 1) return;

    if (this.buffer && (now - this.lastKeyTime < this.SCAN_THRESHOLD_MS || this.completeTimer)) {
      this.buffer += event.key;
    } else {
      this.buffer = event.key;
      this.firstKeyTime = now;
    }
    this.lastKeyTime = now;

    // Auto-complete scan after brief pause (scanner sends Enter, but as a fallback)
    this.scheduleComplete();
  }

  private scheduleComplete(afterStall = false): void {
    if (this.completeTimer) clearTimeout(this.completeTimer);
    const scheduledAt = performance.now();
    this.completeTimer = setTimeout(() => {
      this.completeTimer = null;
      const late = performance.now() - scheduledAt > this.SCAN_COMPLETE_DELAY_MS + this.STALL_TOLERANCE_MS;
      if (late && !afterStall) {
        this.scheduleComplete(true);
        return;
      }
      if (this.isScanBurst()) {
        this.emitScan(this.buffer);
      }
      this.clearBuffer();
    }, this.SCAN_COMPLETE_DELAY_MS);
  }

  private isScanBurst(): boolean {
    if (this.buffer.length < this.MIN_SCAN_LENGTH) return false;
    const meanGap = (this.lastKeyTime - this.firstKeyTime) / (this.buffer.length - 1);
    return meanGap < this.SCAN_THRESHOLD_MS;
  }

  private eventTime(event: KeyboardEvent): number {
    return event.timeStamp > 0 ? event.timeStamp : performance.now();
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
    this.firstKeyTime = 0;
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
