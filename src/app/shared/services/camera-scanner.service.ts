import { Injectable, inject } from '@angular/core';

import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';

import { PlatformService } from './platform.service';

type NativeScanner = typeof import('@capacitor-mlkit/barcode-scanning');

/**
 * One camera-scanning seam for both platforms. Native: ML Kit through
 * @capacitor-mlkit/barcode-scanning, which renders the camera behind the
 * WebView (the page must be transparent while scanning — the shell adds the
 * `mlkit-scanning` class to <body>). Web/PWA: html5-qrcode into the given
 * element. Decodes are de-duplicated per value for 1.5 s so a held code
 * doesn't fire repeatedly.
 */
@Injectable({ providedIn: 'root' })
export class CameraScannerService {
  private readonly platform = inject(PlatformService);

  private web: Html5Qrcode | null = null;
  private native: NativeScanner | null = null;
  private nativeListener: { remove: () => Promise<void> } | null = null;
  private lastValue: string | null = null;
  private lastAt = 0;
  private torchOn = false;

  async start(elementId: string, onDecode: (value: string) => void): Promise<void> {
    const emit = (value: string) => {
      const now = Date.now();
      if (value === this.lastValue && now - this.lastAt < 1500) return;
      this.lastValue = value;
      this.lastAt = now;
      onDecode(value);
    };

    if (this.platform.isNative) {
      this.native = await import('@capacitor-mlkit/barcode-scanning');
      const { BarcodeScanner } = this.native;
      document.body.classList.add('mlkit-scanning');
      this.nativeListener = await BarcodeScanner.addListener('barcodesScanned', (event) => {
        const first = event.barcodes[0];
        if (first?.rawValue) emit(first.rawValue);
      });
      await BarcodeScanner.startScan();
      return;
    }

    this.web = new Html5Qrcode(elementId);
    await this.web.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 200 } },
      (decoded) => emit(decoded),
      () => undefined,
    );
  }

  async stop(): Promise<void> {
    if (this.native) {
      await this.nativeListener?.remove();
      this.nativeListener = null;
      await this.native.BarcodeScanner.stopScan().catch(() => undefined);
      document.body.classList.remove('mlkit-scanning');
      this.torchOn = false;
      return;
    }
    const state = this.web?.getState();
    if (this.web && (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED)) {
      await this.web.stop().catch(() => undefined);
    }
    this.web = null;
  }

  async toggleTorch(): Promise<boolean> {
    if (this.native) {
      this.torchOn = !this.torchOn;
      const { BarcodeScanner } = this.native;
      await (this.torchOn ? BarcodeScanner.enableTorch() : BarcodeScanner.disableTorch()).catch(() => undefined);
      return this.torchOn;
    }
    // html5-qrcode exposes torch through track constraints when the camera supports it.
    try {
      const track = this.web?.getRunningTrackCameraCapabilities();
      const torch = track?.torchFeature();
      if (torch?.isSupported()) {
        this.torchOn = !this.torchOn;
        await torch.apply(this.torchOn);
      }
    } catch {
      // Not supported on this camera — the button simply stays off.
    }
    return this.torchOn;
  }
}
