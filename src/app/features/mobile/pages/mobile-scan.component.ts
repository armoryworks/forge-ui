import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode'; // camera scanner

import { isCapabilityDisabledError } from '../../../shared/errors/capability-disabled.error';
import { ScanResolveResult } from '../../../shared/models/mobile-api.model';
import { ScannerService } from '../../../shared/services/scanner.service';
import { wasHttpErrorShown } from '../../../shared/utils/shown-http-errors';
import { MobileEntityLinkService } from '../services/mobile-entity-link.service';

const MAX_CODE_LENGTH = 200;

type ScanSource = 'camera' | 'manual';

@Component({
  selector: 'app-mobile-scan',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './mobile-scan.component.html',
  styleUrl: './mobile-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileScanComponent implements AfterViewInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslateService);
  private readonly scanner = inject(ScannerService);
  private readonly entityLinks = inject(MobileEntityLinkService);

  protected readonly maxCodeLength = MAX_CODE_LENGTH;

  private html5Qrcode: Html5Qrcode | null = null;
  private readonly readerEl = viewChild<ElementRef<HTMLDivElement>>('reader');

  protected readonly scanning = signal(false);
  protected readonly lastResult = signal<ScanResolveResult | null>(null);
  protected readonly resolving = signal(false);
  protected readonly lookupError = signal<string | null>(null);
  protected readonly lookupHandled = signal(false);
  protected readonly lastSource = signal<ScanSource>('camera');
  protected readonly resultTarget = computed(() => {
    const result = this.lastResult();
    return result ? this.entityLinks.targetFor(result.kind, result.id) : null;
  });
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
        this.error.set(this.translate.instant('mobileLegacyPages.scan.errorPermission'));
      } else if (errorName === 'NotFoundError' || errorMsg.includes('no camera') || errorMsg.includes('Requested device not found')) {
        this.cameraError.set('not-found');
        this.error.set(this.translate.instant('mobileLegacyPages.scan.errorNotFound'));
      } else if (errorName === 'NotReadableError' || errorName === 'AbortError') {
        this.cameraError.set('generic');
        this.error.set(this.translate.instant('mobileLegacyPages.scan.errorInUse'));
      } else if (errorMsg.includes('insecure') || errorMsg.includes('secure context') || errorMsg.includes('https')) {
        this.cameraError.set('insecure');
        this.error.set(this.translate.instant('mobileLegacyPages.scan.errorInsecure'));
      } else {
        this.cameraError.set('generic');
        this.error.set(this.translate.instant('mobileLegacyPages.scan.errorUnavailable'));
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

    this.resolve(value, 'camera');

    // Also emit to global scanner service for other consumers
    this.scanner.setContext('global');
  }

  private resolve(value: string, source: ScanSource): void {
    const code = value.trim();
    if (!code) return;

    this.lastSource.set(source);
    this.lookupError.set(null);
    this.lookupHandled.set(false);
    this.lastResult.set(null);
    if (code.length > MAX_CODE_LENGTH) {
      this.lookupError.set(this.translate.instant('mobileWeb.scan.tooLong', { max: MAX_CODE_LENGTH }));
      return;
    }

    this.resolving.set(true);
    this.http.post<ScanResolveResult>('/api/v1/scanner/resolve', { code }).subscribe({
      next: (result) => {
        this.resolving.set(false);
        if (result.kind === 'job' && result.id !== null) {
          this.router.navigate(['/m/jobs', result.id]);
          return;
        }
        this.lastResult.set(result);
      },
      error: (err: unknown) => {
        this.resolving.set(false);
        if (isCapabilityDisabledError(err)) {
          this.lookupError.set(this.translate.instant('mobileWeb.scan.disabled'));
        } else if (wasHttpErrorShown(err)) {
          this.lookupHandled.set(true);
        } else {
          this.lookupError.set(this.translate.instant('mobileWeb.scan.lookupFailed'));
        }
      },
    });
  }

  protected openResult(): void {
    const target = this.resultTarget();
    if (target) this.entityLinks.open(target);
  }

  protected resumeScanning(): void {
    this.lastResult.set(null);
    this.lookupError.set(null);
    this.lookupHandled.set(false);
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

    this.resolve(value, 'manual');
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
