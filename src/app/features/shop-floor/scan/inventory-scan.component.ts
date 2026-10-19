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

@Component({
  selector: 'app-inventory-scan',
  standalone: true,
  imports: [TranslatePipe, BarcodeScanInputComponent, ScanActionOverlayComponent],
  templateUrl: './inventory-scan.component.html',
  styleUrl: './inventory-scan.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InventoryScanComponent implements OnInit, OnDestroy {
  private readonly scanner = inject(ScannerService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);

  protected readonly recentScans = signal<ScanContext[]>([]);
  protected readonly scanCount = signal(0);

  ngOnInit(): void {
    this.scanner.setContext('inventory');
    this.scanner.restart();
  }

  ngOnDestroy(): void {
    this.scanner.stop();
  }

  protected onManualScan(value: string): void {
    this.scanner.submit(value);
  }

  protected onContextLoaded(ctx: ScanContext): void {
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
