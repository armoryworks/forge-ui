import {
  ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { ScannerService } from '../../../shared/services/scanner.service';
import { ScanContext } from '../../../shared/models/scan-action.model';
import { BarcodeScanInputComponent } from '../../../shared/components/barcode-scan-input/barcode-scan-input.component';
import { ScanActionOverlayComponent } from '../components/scan-action-overlay/scan-action-overlay.component';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AuthService } from '../../../shared/services/auth.service';
import { focusCancelOnOpen } from '../../../shared/utils/focus-dialog-cancel';

const TERMINAL_KEY = 'forge-kiosk-terminal';
const TERMINAL_IDLE_SIGN_OUT_MS = 60_000;

@Component({
  selector: 'app-inventory-scan',
  standalone: true,
  imports: [TranslatePipe, BarcodeScanInputComponent, ScanActionOverlayComponent],
  templateUrl: './inventory-scan.component.html',
  styleUrl: './inventory-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onActivity()',
    '(document:pointerdown)': 'onActivity()',
  },
})
export class InventoryScanComponent implements OnInit, OnDestroy {
  private readonly scanner = inject(ScannerService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly recentScans = signal<ScanContext[]>([]);
  protected readonly scanCount = signal(0);
  private readonly onSharedTerminal = isPairedTerminal();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.scanner.setContext('inventory');
    this.scanner.restart();
    this.armIdleSignOut();
  }

  ngOnDestroy(): void {
    this.clearIdleTimer();
    this.scanner.stop();
  }

  protected onActivity(): void {
    this.armIdleSignOut();
  }

  private armIdleSignOut(): void {
    if (!this.onSharedTerminal) return;
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => this.idleSignOut(), TERMINAL_IDLE_SIGN_OUT_MS);
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private idleSignOut(): void {
    this.idleTimer = null;
    this.dialog.closeAll();
    this.scanner.stop();
    this.authService.clearAuth();
    this.router.navigate(['/display/shop-floor']);
  }

  protected onManualScan(value: string): void {
    this.scanner.submit(value);
  }

  protected onContextLoaded(ctx: ScanContext): void {
    this.armIdleSignOut();
    this.recentScans.update(scans => [ctx, ...scans.filter(s => s.partId !== ctx.partId).slice(0, 9)]);
    this.scanCount.update(c => c + 1);
  }

  protected onOverlayDismissed(): void {
    // Overlay closed — stay on scan page
  }

  // ─── Exit Kiosk ───
  // Deliberate "leave this mode" — mirrors MobileAccountComponent.openDesktop().
  // The kiosk runs without a live session, so exiting must re-authenticate.
  // Confirm first so a mis-tap doesn't drop the worker to login.
  protected exitKiosk(): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('shopFloor.exitKioskConfirmTitle'),
        message: this.translate.instant('shopFloor.exitKioskConfirmMessage'),
        confirmLabel: this.translate.instant('shopFloor.exitKiosk'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    });
    focusCancelOnOpen(ref);
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // Tear down kiosk state, then re-authenticate via /login.
      this.scanner.stop();
      this.authService.clearAuth();
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/dashboard' } });
    });
  }
}

function isPairedTerminal(): boolean {
  try {
    return localStorage.getItem(TERMINAL_KEY) !== null;
  } catch {
    return false;
  }
}
