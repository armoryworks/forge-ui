import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'; // camera scanner

import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ScannerService } from '../../../shared/services/scanner.service';

interface ScanResult {
  value: string;
  type: 'job' | 'part' | 'asset' | 'unknown';
  label: string;
  route: string | null;
}

@Component({
  selector: 'app-mobile-scan',
  standalone: true,
  imports: [],
  templateUrl: './mobile-scan.component.html',
  styleUrl: './mobile-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileScanComponent implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly snackbar = inject(SnackbarService);
  private readonly scanner = inject(ScannerService);

  private html5Qrcode: Html5Qrcode | null = null;
  private readonly readerEl = viewChild<ElementRef<HTMLDivElement>>('reader');

  protected readonly scanning = signal(false);
  protected readonly lastResult = signal<ScanResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly manualValue = signal('');
  protected readonly showManual = signal(false);
  protected readonly cameraUnavailable = signal(false);
  protected readonly cameraError = signal<'permission' | 'not-found' | 'insecure' | 'generic' | null>(null);

  ngAfterViewInit(): void {
    this.startScanner();
  }

  ngOnDestroy(): void {
    this.stopScanner();
  }

  private async startScanner(): Promise<void> {
    const el = this.readerEl();
    if (!el) return;

    try {
      this.html5Qrcode = new Html5Qrcode(el.nativeElement.id);
      this.scanning.set(true);
      this.error.set(null);

      await this.html5Qrcode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText: string) => this.onScanSuccess(decodedText),
        (_errorMessage: string) => { /* ignore scan failures (no code in frame) */ },
      );
    } catch (err) {
      this.scanning.set(false);
      this.cameraUnavailable.set(true);
      this.showManual.set(true);

      const errorName = (err as DOMException)?.name ?? '';
      const errorMsg = (err as Error)?.message ?? String(err);

      if (errorName === 'NotAllowedError' || errorMsg.includes('Permission')) {
        this.cameraError.set('permission');
        this.error.set('Camera permission was denied.');
      } else if (errorName === 'NotFoundError' || errorMsg.includes('no camera') || errorMsg.includes('Requested device not found')) {
        this.cameraError.set('not-found');
        this.error.set('No camera detected on this device.');
      } else if (errorName === 'NotReadableError' || errorName === 'AbortError') {
        this.cameraError.set('generic');
        this.error.set('Camera is in use by another app. Close other apps using the camera and try again.');
      } else if (errorMsg.includes('insecure') || errorMsg.includes('secure context') || errorMsg.includes('https')) {
        this.cameraError.set('insecure');
        this.error.set('Camera requires a secure (HTTPS) connection.');
      } else {
        this.cameraError.set('generic');
        this.error.set('Camera is not available.');
      }
    }
  }

  private async stopScanner(): Promise<void> {
    if (this.html5Qrcode) {
      try {
        const state = this.html5Qrcode.getState();
        if (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED) {
          await this.html5Qrcode.stop();
        }
      } catch {
        // Ignore stop errors on destroy
      }
      this.html5Qrcode = null;
    }
  }

  private onScanSuccess(value: string): void {
    // Pause scanning after a successful read
    if (this.html5Qrcode?.getState() === Html5QrcodeScannerState.SCANNING) {
      this.html5Qrcode.pause(true);
    }

    const result = this.parseScannedValue(value);
    this.lastResult.set(result);

    // Also emit to global scanner service for other consumers
    this.scanner.setContext('global');
  }

  protected parseScannedValue(value: string): ScanResult {
    const trimmed = value.trim();

    // Job number pattern: JOB-XXXX or job number
    const jobMatch = trimmed.match(/^JOB-(\d+)$/i);
    if (jobMatch) {
      return {
        value: trimmed,
        type: 'job',
        label: `Job ${trimmed}`,
        route: `/m/jobs`,
      };
    }

    // Part number pattern: letters + numbers (e.g., PT-1234, PART-5678)
    const partMatch = trimmed.match(/^(PT|PART|PRT)-(\d+)$/i);
    if (partMatch) {
      return {
        value: trimmed,
        type: 'part',
        label: `Part ${trimmed}`,
        route: `/parts`,
      };
    }

    // Asset tag pattern: AST-XXXX or ASSET-XXXX
    const assetMatch = trimmed.match(/^(AST|ASSET)-(\d+)$/i);
    if (assetMatch) {
      return {
        value: trimmed,
        type: 'asset',
        label: `Asset ${trimmed}`,
        route: `/assets`,
      };
    }

    // URL-based routing (QR codes with full URLs)
    if (trimmed.includes('/m/') || trimmed.includes('/parts/') || trimmed.includes('/jobs/')) {
      try {
        const url = new URL(trimmed);
        return {
          value: trimmed,
          type: 'unknown',
          label: `Navigate to ${url.pathname}`,
          route: url.pathname,
        };
      } catch {
        // Not a valid URL, fall through
      }
    }

    return {
      value: trimmed,
      type: 'unknown',
      label: `Scanned: ${trimmed}`,
      route: null,
    };
  }

  protected navigateToResult(): void {
    const result = this.lastResult();
    if (!result?.route) {
      this.snackbar.info('No matching entity found for this scan');
      return;
    }
    this.router.navigateByUrl(result.route);
  }

  protected resumeScanning(): void {
    this.lastResult.set(null);
    if (this.html5Qrcode?.getState() === Html5QrcodeScannerState.PAUSED) {
      this.html5Qrcode.resume();
    }
  }

  protected async retryCamera(): Promise<void> {
    await this.stopScanner();
    this.cameraUnavailable.set(false);
    this.cameraError.set(null);
    this.error.set(null);
    this.lastResult.set(null);

    // Small delay to allow DOM to re-render the #reader element
    setTimeout(() => this.startScanner(), 100);
  }

  protected toggleManual(): void {
    this.showManual.update((v) => !v);
  }

  protected submitManual(): void {
    const value = this.manualValue().trim();
    if (!value) return;

    const result = this.parseScannedValue(value);
    this.lastResult.set(result);
    this.manualValue.set('');
  }

  protected onManualInput(event: Event): void {
    this.manualValue.set((event.target as HTMLInputElement).value);
  }

  protected onManualKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.submitManual();
    }
  }
}
