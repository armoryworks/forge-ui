import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, OnDestroy, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin, interval } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { BarcodeScanInputComponent } from '../../../shared/components/barcode-scan-input/barcode-scan-input.component';
import { KioskSearchBarComponent } from '../components/kiosk-search-bar/kiosk-search-bar.component';
import { KioskSetupComponent } from '../components/kiosk-setup/kiosk-setup.component';
import { ShopFloorService } from '../services/shop-floor.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ClockEventTypeDef, ClockEventTypeService } from '../../../shared/services/clock-event-type.service';
import { WebHidRfidService } from '../../../shared/services/web-hid-rfid.service';
import { MobileApiService } from '../../../shared/services/mobile-api.service';
import { ClockWorker } from '../models/clock-worker.model';
import { ShopFloorOverview } from '../models/shop-floor-overview.model';
import { KioskTerminal } from '../models/kiosk-terminal.model';
import { ScanIdentification } from '../models/scan-identification.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

const REFRESH_INTERVAL_MS = 15_000;
const AUTO_LOGOUT_MS = 30_000;
const PUNCH_FEEDBACK_MS = 2_000;
const PUNCH_UNDO_MS = 10_000;
const PUNCH_UNDO_RESULT_MS = 4_000;
const SUPERVISE_ROLES = ['Admin', 'Manager'];

type KioskPhase = 'setup' | 'dashboard' | 'identifying' | 'pin' | 'job-scanned' | 'manual-login' | 'clock';
type PunchUndoState = 'offered' | 'undoing' | 'undone' | 'failed';

@Component({
  selector: 'app-shop-floor-clock',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, NgTemplateOutlet, TranslatePipe, AvatarComponent, InputComponent, BarcodeScanInputComponent, KioskSearchBarComponent, KioskSetupComponent],
  templateUrl: './shop-floor-clock.component.html',
  styleUrl: './shop-floor-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopFloorClockComponent implements OnInit, OnDestroy {
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly authService = inject(AuthService);
  private readonly rfid = inject(WebHidRfidService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly mobileApi = inject(MobileApiService);
  protected readonly clockTypes = inject(ClockEventTypeService);

  // Terminal config
  protected readonly terminal = signal<KioskTerminal | null>(null);
  private get teamId(): number | undefined {
    return this.terminal()?.teamId;
  }

  // Dashboard data
  protected readonly workers = signal<ClockWorker[]>([]);
  protected readonly overview = signal<ShopFloorOverview | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly clockDisplay = signal('');
  protected readonly dateDisplay = signal('');
  protected readonly processing = signal<number | null>(null);

  // Computed dashboard views
  protected readonly workersIn = computed(() => this.workers().filter(w => this.clockTypes.isWorking(w.status)));
  protected readonly workersOnBreak = computed(() => this.workers().filter(w => this.clockTypes.isOnBreakOrLunch(w.status)));
  protected readonly workersOut = computed(() => this.workers().filter(w => this.clockTypes.isClockedOut(w.status)));
  protected readonly activeJobs = computed(() => this.overview()?.activeJobs ?? []);
  protected readonly completedToday = computed(() => this.overview()?.completedToday ?? 0);
  protected readonly overdueJobs = computed(() => this.activeJobs().filter(j => j.isOverdue).length);

  // Kiosk auth state
  protected readonly kioskPhase = signal<KioskPhase>('setup');
  protected readonly scannedBarcode = signal<string | null>(null);
  protected readonly kioskAuthError = signal<string | null>(null);
  protected readonly kioskAuthenticating = signal(false);
  protected readonly pinControl = new FormControl('');

  // Dual-scan: job context (when job barcode is scanned first)
  protected readonly scannedJob = signal<ScanIdentification | null>(null);
  protected readonly scanIdentifying = signal(false);

  // Manual login state
  protected readonly emailControl = new FormControl('');
  protected readonly passwordControl = new FormControl('');
  protected readonly manualLoginError = signal<string | null>(null);
  protected readonly manualLoggingIn = signal(false);

  // Clock phase
  protected readonly clockedIn = computed(() => this.workers().filter(w => w.isClockedIn));
  protected readonly clockedOut = computed(() => this.workers().filter(w => !w.isClockedIn));
  private readonly signedInUserId = computed(() => this.authService.user()?.id ?? null);
  protected readonly canSupervise = computed(() =>
    this.authService.user()?.roles.some(r => SUPERVISE_ROLES.includes(r)) ?? false);
  protected readonly selfWorker = computed(() =>
    this.workers().find(w => w.userId === this.signedInUserId()) ?? null);
  protected readonly otherWorkers = computed(() =>
    this.canSupervise() ? this.workers().filter(w => w.userId !== this.signedInUserId()) : []);
  protected readonly notSetUpForWorker = computed(() =>
    this.selfWorker() === null && this.otherWorkers().length === 0);
  protected readonly punchError = signal<{ detail: string } | null>(null);
  protected readonly punchRecorded = signal<string | null>(null);
  protected readonly punchUndoMessage = signal<string | null>(null);
  protected readonly punchUndoState = signal<PunchUndoState | null>(null);

  private autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;
  private punchFeedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private punchUndoTimer: ReturnType<typeof setTimeout> | null = null;
  private punchUndoEventId: number | null = null;
  private punchUndoToken: string | null = null;
  private punchUndoSeq = 0;

  // Bridge RFID relay scans into the kiosk scan flow
  private readonly rfidBridge = effect(() => {
    const rfidScan = this.rfid.lastScan();
    if (!rfidScan) return;
    // Only handle on dashboard or job-scanned phases (same as BarcodeScanInput)
    const phase = this.kioskPhase();
    if (phase !== 'dashboard' && phase !== 'job-scanned') return;
    this.rfid.clearLastScan();
    this.onScanDetected(rfidScan.uid);
  });

  ngOnInit(): void {
    this.authService.clearAuth();
    this.clockTypes.load();
    this.updateClock();

    // Connect to RFID relay (silent, no error if not running)
    this.rfid.reconnect();

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateClock());

    // Check for existing terminal config
    this.checkTerminalConfig();
  }

  ngOnDestroy(): void {
    this.rfid.disconnect();
    this.clearAutoLogoutTimer();
    this.clearPunchFeedbackTimer();
    this.clearPunchUndo();
  }

  private checkTerminalConfig(): void {
    const deviceToken = localStorage.getItem('forge-kiosk-device-token');
    if (!deviceToken) {
      this.kioskPhase.set('setup');
      return;
    }

    // Validate token against backend
    this.shopFloorService.getTerminal(deviceToken).subscribe({
      next: (terminal) => {
        this.terminal.set(terminal);
        this.startDashboard();
      },
      error: () => {
        // Terminal not found or deactivated — re-setup
        localStorage.removeItem('forge-kiosk-device-token');
        localStorage.removeItem('forge-kiosk-terminal');
        this.kioskPhase.set('setup');
      },
    });
  }

  protected onTerminalConfigured(terminal: KioskTerminal): void {
    this.terminal.set(terminal);
    this.startDashboard();
  }

  private startDashboard(): void {
    this.kioskPhase.set('dashboard');
    this.loadData();

    interval(REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.kioskPhase() === 'dashboard') {
          this.loadData();
        }
      });
  }

  // ─── Dual-Scan Flow (employee badge OR job barcode — any order) ───

  protected onScanDetected(scanValue: string): void {
    // If we're in the job-scanned phase, this second scan is the employee badge
    if (this.kioskPhase() === 'job-scanned') {
      this.scannedBarcode.set(scanValue);
      this.kioskAuthError.set(null);
      this.pinControl.reset();
      this.kioskPhase.set('pin');
      return;
    }

    // First scan from dashboard — identify what was scanned
    this.scanIdentifying.set(true);
    this.error.set(null);

    this.shopFloorService.identifyScan(scanValue).subscribe({
      next: (result) => {
        this.scanIdentifying.set(false);
        this.handleScanIdentified(scanValue, result);
      },
      error: () => {
        // Identification failed — fall back to treating it as employee badge
        this.scanIdentifying.set(false);
        this.scannedBarcode.set(scanValue);
        this.kioskAuthError.set(null);
        this.pinControl.reset();
        this.kioskPhase.set('pin');
      },
    });
  }

  private handleScanIdentified(scanValue: string, result: ScanIdentification): void {
    switch (result.scanType) {
      case 'employee':
        // Employee badge scanned — go straight to PIN
        this.scannedBarcode.set(scanValue);
        this.kioskAuthError.set(null);
        this.pinControl.reset();
        this.kioskPhase.set('pin');
        break;

      case 'job':
        // Job barcode scanned — store job context, prompt for employee badge
        this.scannedJob.set(result);
        this.kioskAuthError.set(null);
        this.kioskPhase.set('job-scanned');
        break;

      case 'unknown':
      default:
        // Unrecognized — show error on dashboard
        this.error.set(this.translate.instant('shopFloor.scanNotRecognized', { value: scanValue }));
        break;
    }
  }

  protected onPinSubmit(): void {
    const scanValue = this.scannedBarcode();
    const pin = this.pinControl.value?.trim();
    if (!scanValue || !pin || pin.length < 4) {
      this.kioskAuthError.set(this.translate.instant('shopFloor.pinMinDigits'));
      return;
    }

    this.kioskAuthenticating.set(true);
    this.kioskAuthError.set(null);

    this.authService.scanLogin(scanValue, pin).subscribe({
      next: () => {
        this.kioskAuthenticating.set(false);
        this.enterClockPhase();
      },
      error: () => {
        this.kioskAuthenticating.set(false);
        this.kioskAuthError.set(this.translate.instant('shopFloor.badgeOrPinInvalid'));
      },
    });
  }

  protected cancelPin(): void {
    this.resetToDashboard();
  }

  protected cancelJobScanned(): void {
    this.resetToDashboard();
  }

  // ─── Manual Login Flow ───
  protected showManualLogin(): void {
    this.emailControl.reset();
    this.passwordControl.reset();
    this.manualLoginError.set(null);
    this.kioskPhase.set('manual-login');
  }

  protected onManualLoginSubmit(): void {
    const email = this.emailControl.value?.trim();
    const password = this.passwordControl.value;
    if (!email || !password) {
      this.manualLoginError.set(this.translate.instant('shopFloor.emailPasswordRequired'));
      return;
    }

    this.manualLoggingIn.set(true);
    this.manualLoginError.set(null);

    this.authService.login({ email, password }).subscribe({
      next: () => {
        this.manualLoggingIn.set(false);
        this.enterClockPhase();
      },
      error: () => {
        this.manualLoggingIn.set(false);
        this.manualLoginError.set(this.translate.instant('shopFloor.invalidCredentials'));
      },
    });
  }

  protected cancelManualLogin(): void {
    this.resetToDashboard();
  }

  // ─── Clock Phase ───
  private enterClockPhase(): void {
    this.loadData();
    this.kioskPhase.set('clock');
    this.startAutoLogoutTimer();
  }

  protected clockAction(worker: ClockWorker, action: ClockEventTypeDef): void {
    if (this.processing() !== null || this.punchRecorded() !== null) return;
    this.processing.set(worker.userId);
    this.punchError.set(null);
    this.resetAutoLogoutTimer();

    this.shopFloorService.clockInOut(worker.userId, action.code).subscribe({
      next: () => {
        this.processing.set(null);
        this.clearAutoLogoutTimer();
        const time = this.formatTime(new Date().toISOString());
        this.punchRecorded.set(this.translate.instant('shopFloor.punchRecorded', { event: action.label, time }));
        if (worker.userId === this.signedInUserId()) {
          this.offerPunchUndo(this.translate.instant('kioskSetup.punchUndo.offer', {
            name: worker.name, event: action.label, time,
          }));
        }
        this.punchFeedbackTimer = setTimeout(() => this.ephemeralLogout(), PUNCH_FEEDBACK_MS);
      },
      error: (err: HttpErrorResponse) => {
        this.processing.set(null);
        this.punchError.set({ detail: err?.error?.detail ?? err?.error?.title ?? '' });
      },
    });
  }

  protected undoPunch(): void {
    const eventId = this.punchUndoEventId;
    const token = this.punchUndoToken;
    if (eventId === null || token === null || this.punchUndoState() !== 'offered') return;
    this.punchUndoState.set('undoing');
    const seq = this.punchUndoSeq;
    this.mobileApi.undoClockPunch(eventId, token, true).subscribe({
      next: () => {
        if (seq !== this.punchUndoSeq) return;
        this.showPunchUndoResult('undone', 'kioskSetup.punchUndo.undone');
        this.loadData();
      },
      error: () => {
        if (seq !== this.punchUndoSeq) return;
        this.showPunchUndoResult('failed', 'kioskSetup.punchUndo.failed');
      },
    });
  }

  private showPunchUndoResult(state: PunchUndoState, messageKey: string): void {
    if (this.punchUndoTimer) clearTimeout(this.punchUndoTimer);
    this.punchUndoState.set(state);
    this.punchUndoMessage.set(this.translate.instant(messageKey));
    this.punchUndoTimer = setTimeout(() => this.clearPunchUndo(), PUNCH_UNDO_RESULT_MS);
  }

  private offerPunchUndo(message: string): void {
    this.clearPunchUndo();
    const token = this.authService.token();
    if (!token) return;
    const timer = setTimeout(() => {
      if (this.punchUndoState() !== 'undoing') this.clearPunchUndo();
    }, PUNCH_UNDO_MS);
    this.punchUndoTimer = timer;
    this.mobileApi.clockState().subscribe({
      next: (state) => {
        if (this.punchUndoTimer !== timer || state.lastEventId === null) return;
        this.punchUndoEventId = state.lastEventId;
        this.punchUndoToken = token;
        this.punchUndoMessage.set(message);
        this.punchUndoState.set('offered');
      },
      error: () => {
        if (this.punchUndoTimer === timer) this.clearPunchUndo();
      },
    });
  }

  private clearPunchUndo(): void {
    this.punchUndoSeq++;
    if (this.punchUndoTimer) {
      clearTimeout(this.punchUndoTimer);
      this.punchUndoTimer = null;
    }
    this.punchUndoEventId = null;
    this.punchUndoToken = null;
    this.punchUndoMessage.set(null);
    this.punchUndoState.set(null);
  }

  // ─── Ephemeral Auth ───
  private ephemeralLogout(): void {
    this.clearAutoLogoutTimer();
    this.authService.clearAuth();
    this.loadData();
    this.resetToDashboard();
  }

  protected resetToDashboard(): void {
    this.clearAutoLogoutTimer();
    this.clearPunchFeedbackTimer();
    this.punchError.set(null);
    this.punchRecorded.set(null);
    this.authService.clearAuth();
    this.scannedBarcode.set(null);
    this.scannedJob.set(null);
    this.kioskAuthError.set(null);
    this.manualLoginError.set(null);
    this.scanIdentifying.set(false);
    this.pinControl.reset();
    this.emailControl.reset();
    this.passwordControl.reset();
    this.kioskPhase.set('dashboard');
  }

  // ─── Exit Kiosk ───
  // Deliberate "leave this mode" — mirrors MobileAccountComponent.openDesktop().
  // Entering the kiosk clears the JWT, so there's no live session to return to;
  // exiting must re-authenticate. Confirm first so a mis-tap doesn't drop the
  // worker to login.
  protected exitKiosk(): void {
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('shopFloor.exitKioskConfirmTitle'),
        message: this.translate.instant('shopFloor.exitKioskConfirmMessage'),
        confirmLabel: this.translate.instant('shopFloor.exitKiosk'),
        severity: 'warn',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      // Tear down kiosk state, then re-authenticate via /login.
      this.rfid.disconnect();
      this.resetToDashboard(); // clears timers and calls authService.clearAuth()
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/dashboard' } });
    });
  }

  private startAutoLogoutTimer(): void {
    this.clearAutoLogoutTimer();
    this.autoLogoutTimer = setTimeout(() => this.ephemeralLogout(), AUTO_LOGOUT_MS);
  }

  private resetAutoLogoutTimer(): void {
    this.startAutoLogoutTimer();
  }

  private clearAutoLogoutTimer(): void {
    if (this.autoLogoutTimer) {
      clearTimeout(this.autoLogoutTimer);
      this.autoLogoutTimer = null;
    }
  }

  private clearPunchFeedbackTimer(): void {
    if (this.punchFeedbackTimer) {
      clearTimeout(this.punchFeedbackTimer);
      this.punchFeedbackTimer = null;
    }
  }

  // ─── Display Helpers ───
  protected formatTime(isoDate: string | null): string {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  protected priorityClass(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'sf-job__priority--urgent';
      case 'High': return 'sf-job__priority--high';
      default: return '';
    }
  }

  private loadData(): void {
    forkJoin({
      workers: this.shopFloorService.getClockStatus(this.teamId),
      overview: this.shopFloorService.getOverview(this.teamId),
    }).subscribe({
      next: ({ workers, overview }) => {
        this.workers.set(workers);
        this.overview.set(overview);
        this.error.set(null);
      },
      error: () => this.error.set(this.translate.instant('shopFloor.loadFailed')),
    });
  }

  private updateClock(): void {
    const now = new Date();
    this.clockDisplay.set(
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
    this.dateDisplay.set(
      now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    );
  }
}
