import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';

import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SharedIdentityService } from '../../../shared/services/shared-identity.service';
import { PinPadComponent } from '../lock/pin-pad.component';

type IdentityStage = 'badge' | 'pin';

/**
 * Shared-device identity: scan the badge, enter the PIN, and the person is
 * attributed to the next transaction. Emits `identified` on success.
 */
@Component({
  selector: 'app-identity-prompt',
  standalone: true,
  imports: [TranslatePipe, PinPadComponent],
  templateUrl: './identity-prompt.component.html',
  styleUrl: './identity-prompt.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IdentityPromptComponent implements AfterViewInit, OnDestroy {
  private readonly identity = inject(SharedIdentityService);
  private readonly translate = inject(TranslateService);

  private readonly viewfinder = viewChild<ElementRef<HTMLDivElement>>('badgeViewfinder');

  readonly identified = output<void>();
  readonly cancelled = output<void>();

  protected readonly stage = signal<IdentityStage>('badge');
  protected readonly cameraError = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  private scanValue: string | null = null;
  private scanner: Html5Qrcode | null = null;

  async ngAfterViewInit(): Promise<void> {
    const el = this.viewfinder();
    if (!el) return;
    try {
      this.scanner = new Html5Qrcode(el.nativeElement.id);
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 160 } },
        (decoded) => this.onBadge(decoded),
        () => undefined,
      );
    } catch {
      this.cameraError.set(this.translate.instant('mobileApp.identity.cameraError'));
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.stopScanner();
  }

  protected async onPin(pin: string): Promise<void> {
    if (!this.scanValue || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.identity.identify(this.scanValue, pin).subscribe({
      next: () => {
        this.busy.set(false);
        this.identified.emit();
      },
      error: () => {
        this.busy.set(false);
        this.error.set(this.translate.instant('mobileApp.identity.failed'));
      },
    });
  }

  protected cancel(): void {
    this.cancelled.emit();
  }

  private async onBadge(decoded: string): Promise<void> {
    if (this.scanValue) return;
    this.scanValue = decoded.trim();
    await this.stopScanner();
    this.stage.set('pin');
  }

  private async stopScanner(): Promise<void> {
    const state = this.scanner?.getState();
    if (this.scanner &&
        (state === Html5QrcodeScannerState.SCANNING || state === Html5QrcodeScannerState.PAUSED)) {
      await this.scanner.stop().catch(() => undefined);
    }
  }
}
