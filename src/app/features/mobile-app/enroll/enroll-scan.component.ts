import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { LanguageToggleComponent } from '../../../shared/components/language-toggle/language-toggle.component';
import { EnrollmentQrPayload } from '../../../shared/models/mobile-auth.model';
import { MobileAuthService } from '../../../shared/services/mobile-auth.service';

/**
 * First run: a viewfinder waiting for the admin's enrollment QR, and one
 * escape hatch to the manual server-address path. Decode → exchange →
 * land on Scan, under sixty seconds, no password typed.
 */
@Component({
  selector: 'app-enroll-scan',
  standalone: true,
  imports: [RouterLink, TranslatePipe, LanguageToggleComponent],
  templateUrl: './enroll-scan.component.html',
  styleUrl: './enroll-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnrollScanComponent implements AfterViewInit, OnDestroy {
  private readonly mobileAuth = inject(MobileAuthService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);

  private readonly viewfinder = viewChild.required<ElementRef<HTMLDivElement>>('viewfinder');

  protected readonly enrolling = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly enrollError = signal<string | null>(null);

  private scanner: Html5Qrcode | null = null;
  private exchanging = false;

  async ngAfterViewInit(): Promise<void> {
    try {
      this.scanner = new Html5Qrcode(this.viewfinder().nativeElement.id);
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded) => this.onDecoded(decoded),
        () => undefined,
      );
    } catch {
      this.cameraError.set(this.translate.instant('mobileApp.enroll.cameraError'));
    }
  }

  async ngOnDestroy(): Promise<void> {
    if (this.scanner &&
        (this.scanner.getState() === Html5QrcodeScannerState.SCANNING ||
         this.scanner.getState() === Html5QrcodeScannerState.PAUSED)) {
      await this.scanner.stop().catch(() => undefined);
    }
  }

  private onDecoded(decoded: string): void {
    if (this.exchanging) return;

    let payload: EnrollmentQrPayload;
    try {
      payload = JSON.parse(decoded) as EnrollmentQrPayload;
      if (!payload.server || !payload.token) throw new Error('shape');
    } catch {
      this.enrollError.set(this.translate.instant('mobileApp.enroll.notAnEnrollmentCode'));
      return;
    }

    this.exchanging = true;
    this.enrolling.set(true);
    this.enrollError.set(null);

    this.mobileAuth.enrollWithQr(payload).subscribe({
      next: () => this.router.navigate(['/app/scan']),
      error: () => {
        this.exchanging = false;
        this.enrolling.set(false);
        this.enrollError.set(this.translate.instant('mobileApp.enroll.enrollFailed'));
      },
    });
  }
}
