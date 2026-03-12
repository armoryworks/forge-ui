import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, interval } from 'rxjs';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { BarcodeScanInputComponent } from '../../../shared/components/barcode-scan-input/barcode-scan-input.component';
import { KioskSearchBarComponent } from '../components/kiosk-search-bar/kiosk-search-bar.component';
import { KioskSetupComponent } from '../components/kiosk-setup/kiosk-setup.component';
import { ShopFloorService } from '../services/shop-floor.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ClockWorker } from '../models/clock-worker.model';
import { ShopFloorOverview } from '../models/shop-floor-overview.model';
import { KioskTerminal } from '../models/kiosk-terminal.model';
import { ScanIdentification } from '../models/scan-identification.model';

const REFRESH_INTERVAL_MS = 15_000;
const AUTO_LOGOUT_MS = 30_000;

type KioskPhase = 'setup' | 'dashboard' | 'identifying' | 'pin' | 'job-scanned' | 'manual-login' | 'clock';

@Component({
  selector: 'app-shop-floor-clock',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent, InputComponent, BarcodeScanInputComponent, KioskSearchBarComponent, KioskSetupComponent],
  templateUrl: './shop-floor-clock.component.html',
  styleUrl: './shop-floor-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopFloorClockComponent implements OnInit {
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

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
  protected readonly workersIn = computed(() => this.workers().filter(w => w.status === 'In'));
  protected readonly workersOnBreak = computed(() => this.workers().filter(w => w.status === 'OnBreak'));
  protected readonly workersOut = computed(() => this.workers().filter(w => w.status === 'Out'));
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

  private autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.authService.clearAuth();
    this.updateClock();

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateClock());

    // Check for existing terminal config
    this.checkTerminalConfig();
  }

  private checkTerminalConfig(): void {
    const deviceToken = localStorage.getItem('qbe-kiosk-device-token');
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
        localStorage.removeItem('qbe-kiosk-device-token');
        localStorage.removeItem('qbe-kiosk-terminal');
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
        this.error.set(`Scan not recognized: "${scanValue}". Try your badge or a job barcode.`);
        break;
    }
  }

  protected onPinSubmit(): void {
    const scanValue = this.scannedBarcode();
    const pin = this.pinControl.value?.trim();
    if (!scanValue || !pin || pin.length < 4) {
      this.kioskAuthError.set('PIN must be at least 4 digits.');
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
        this.kioskAuthError.set('Badge not recognized or invalid PIN. Please try again.');
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
      this.manualLoginError.set('Email and password are required.');
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
        this.manualLoginError.set('Invalid email or password. Please try again.');
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

  protected clockAction(worker: ClockWorker, eventType: string): void {
    if (this.processing()) return;
    this.processing.set(worker.userId);
    this.resetAutoLogoutTimer();

    this.shopFloorService.clockInOut(worker.userId, eventType).subscribe({
      next: () => {
        this.processing.set(null);
        this.ephemeralLogout();
      },
      error: () => {
        this.processing.set(null);
        this.ephemeralLogout();
      },
    });
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
      error: () => this.error.set('Failed to load shop floor data'),
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
