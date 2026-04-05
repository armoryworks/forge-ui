import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, effect, ElementRef, HostBinding, inject, OnDestroy, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, interval } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { InputComponent } from '../../shared/components/input/input.component';
import { KioskSearchBarComponent } from './components/kiosk-search-bar/kiosk-search-bar.component';
import { ShopFloorService } from './services/shop-floor.service';
import { AuthService } from '../../shared/services/auth.service';
import { ScannerService } from '../../shared/services/scanner.service';
import { ShopFloorOverview, ShopFloorJob } from './models/shop-floor-overview.model';
import { ClockWorker } from './models/clock-worker.model';

const REFRESH_INTERVAL_MS = 15_000;
const AUTO_LOGOUT_MS = 30_000;

type DisplayPhase = 'main' | 'pin' | 'actions' | 'job-select';

@Component({
  selector: 'app-shop-floor-display',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent, InputComponent, KioskSearchBarComponent],
  templateUrl: './shop-floor-display.component.html',
  styleUrl: './shop-floor-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopFloorDisplayComponent implements OnInit, OnDestroy {
  @HostBinding('attr.data-theme') readonly dataTheme = 'light';

  private readonly shopFloorService = inject(ShopFloorService);
  private readonly authService = inject(AuthService);
  private readonly scanner = inject(ScannerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  // Data
  protected readonly overview = signal<ShopFloorOverview | null>(null);
  protected readonly workers = signal<ClockWorker[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly clockDisplay = signal('');

  // Live elapsed times — recomputed every second via tick signal
  private readonly tick = signal(0);
  protected readonly workerTimes = computed(() => {
    this.tick(); // subscribe to tick
    const now = Date.now();
    const map: Record<number, string> = {};
    for (const w of this.workers()) {
      if (w.statusSince) {
        const elapsed = now - new Date(w.statusSince).getTime();
        map[w.userId] = this.formatDuration(elapsed);
      } else {
        map[w.userId] = w.timeOnTask;
      }
    }
    return map;
  });

  // Computed worker groups
  protected readonly workersIn = computed(() => this.workers().filter(w => w.status === 'In'));
  protected readonly workersOnBreak = computed(() => this.workers().filter(w => w.status === 'OnBreak'));
  protected readonly workersOut = computed(() => this.workers().filter(w => w.status === 'Out'));
  protected readonly activeWorkers = computed(() => this.workers().filter(w => w.status !== 'Out'));
  protected readonly inactiveWorkers = computed(() => this.workers().filter(w => w.status === 'Out'));
  protected readonly activeJobs = computed(() => this.overview()?.activeJobs ?? []);
  protected readonly unassignedJobs = computed(() =>
    this.activeJobs().filter(j => !j.assigneeId),
  );
  protected readonly completedToday = computed(() => this.overview()?.completedToday ?? 0);
  protected readonly maxVisibleJobs = 4;
  protected readonly maintenanceAlerts = computed(() => this.overview()?.maintenanceAlerts ?? 0);

  // Phase state
  protected readonly phase = signal<DisplayPhase>('main');
  protected readonly selectedWorker = signal<ClockWorker | null>(null);

  // Auth state (scan → PIN, card tap → password)
  protected readonly scannedValue = signal<string | null>(null);
  protected readonly isPasswordAuth = computed(() => this.scannedValue() === null);
  protected readonly pinControl = new FormControl('');
  protected readonly pinError = signal<string | null>(null);
  protected readonly authenticating = signal(false);

  // Action state
  protected readonly processing = signal<string | null>(null);
  protected readonly actionFeedback = signal<{ workerId: number; success: boolean } | null>(null);

  // Job selection state (shown after clock-in if worker has no assignments)
  protected readonly jobSelectWorker = signal<ClockWorker | null>(null);

  // Drag-and-drop state
  protected readonly draggingJobId = signal<number | null>(null);
  protected readonly dropTargetUserId = signal<number | null>(null);

  // Scan feedback
  protected readonly scanFeedback = signal<string | null>(null);

  private readonly elRef = inject(ElementRef);

  private autoLogoutTimer: ReturnType<typeof setTimeout> | null = null;

  // Auto-focus PIN field when entering PIN phase
  private readonly pinFocusEffect = effect(() => {
    if (this.phase() === 'pin') {
      setTimeout(() => {
        const input = (this.elRef.nativeElement as HTMLElement).querySelector('.sf-auth-card__field input') as HTMLInputElement | null;
        input?.focus();
      }, 50);
    }
  });

  // Passive scan listener — reacts to ScannerService signals
  private readonly scanEffect = effect(() => {
    const scan = this.scanner.lastScan();
    if (!scan || scan.context !== 'shop-floor') return;
    this.scanner.clearLastScan();

    // Only handle scans on the main dashboard — ignore during overlays
    if (this.phase() !== 'main') return;

    this.handleScanValue(scan.value);
  });

  ngOnInit(): void {
    this.authService.clearAuth();
    this.loadData();
    this.updateClock();

    // Start passive scanner — listens to keyboard-wedge / RFID on document, no focus needed
    this.scanner.setContext('shop-floor');
    this.scanner.start();

    interval(REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.phase() === 'main') this.loadData();
      });

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateClock());
  }

  ngOnDestroy(): void {
    this.scanner.stop();
  }

  // ─── Scan Handling ───

  private handleScanValue(scanValue: string): void {
    // Identify the scan via API — could be employee badge, RFID, or job barcode
    this.shopFloorService.identifyScan(scanValue).subscribe({
      next: (result) => {
        if (result.scanType === 'employee') {
          const worker = this.workers().find(w => w.userId === result.entityId);
          if (worker) {
            this.enterPinPhase(worker, scanValue);
          } else {
            this.showScanFeedback('Employee not found in current team');
          }
        } else if (result.scanType === 'job') {
          this.showScanFeedback(`Job ${result.entityNumber} — ${result.entityTitle}`);
        } else {
          this.showScanFeedback(`Scan not recognized: ${scanValue}`);
        }
      },
      error: () => {
        // Identification failed — treat as badge scan anyway (fallback)
        this.scannedValue.set(scanValue);
        this.pinControl.reset();
        this.pinError.set(null);
        this.phase.set('pin');
      },
    });
  }

  private showScanFeedback(message: string): void {
    this.scanFeedback.set(message);
    setTimeout(() => this.scanFeedback.set(null), 4000);
  }

  // ─── Worker Selection (tap on card → PIN) ───

  protected selectWorker(worker: ClockWorker): void {
    // Tapping a card identifies the worker — still need PIN to authenticate
    this.enterPinPhase(worker, null);
  }

  private enterPinPhase(worker: ClockWorker, scanValue: string | null): void {
    this.selectedWorker.set(worker);
    this.scannedValue.set(scanValue);
    this.pinControl.reset();
    this.pinError.set(null);
    this.phase.set('pin');
  }

  // ─── PIN Auth ───

  protected onPinSubmit(): void {
    const credential = this.pinControl.value?.trim();
    const scanValue = this.scannedValue();
    const worker = this.selectedWorker();

    if (scanValue) {
      // Scan-based auth: scanValue + PIN
      if (!credential || credential.length < 4) {
        this.pinError.set('PIN must be at least 4 digits');
        return;
      }
      this.authenticating.set(true);
      this.pinError.set(null);
      this.authService.scanLogin(scanValue, credential).subscribe({
        next: () => {
          this.authenticating.set(false);
          this.enterActionsPhase();
        },
        error: () => {
          this.authenticating.set(false);
          this.pinError.set('Invalid badge or PIN');
        },
      });
    } else if (worker) {
      // Card-tap auth: full password required
      if (!credential || credential.length < 1) {
        this.pinError.set('Password is required');
        return;
      }
      this.authenticating.set(true);
      this.pinError.set(null);
      this.authService.login({ email: worker.email, password: credential }).subscribe({
        next: () => {
          this.authenticating.set(false);
          this.enterActionsPhase();
        },
        error: () => {
          this.authenticating.set(false);
          this.pinError.set('Invalid password');
        },
      });
    }
  }

  protected cancelPin(): void {
    this.resetToMain();
  }

  // ─── Actions Phase ───

  private enterActionsPhase(): void {
    this.loadData();
    this.phase.set('actions');
    this.startAutoLogoutTimer();
  }

  protected clockAction(worker: ClockWorker, eventType: string): void {
    const key = `${worker.userId}-${eventType}`;
    if (this.processing()) return;
    this.processing.set(key);
    this.resetAutoLogoutTimer();

    this.shopFloorService.clockInOut(worker.userId, eventType).subscribe({
      next: () => {
        this.processing.set(null);
        this.actionFeedback.set({ workerId: worker.userId, success: true });
        this.loadData();

        // After clock-in, if worker has no assignments → show job picker
        if (eventType === 'ClockIn' && worker.assignments.length === 0) {
          setTimeout(() => {
            this.actionFeedback.set(null);
            this.jobSelectWorker.set(worker);
            this.phase.set('job-select');
          }, 800);
        } else {
          setTimeout(() => {
            this.actionFeedback.set(null);
            this.ephemeralLogout();
          }, 1500);
        }
      },
      error: () => {
        this.processing.set(null);
        this.actionFeedback.set({ workerId: worker.userId, success: false });
        setTimeout(() => this.actionFeedback.set(null), 3000);
      },
    });
  }

  // ─── Job Selection ───

  protected selectJob(job: ShopFloorJob): void {
    const worker = this.jobSelectWorker();
    if (!worker || this.processing()) return;
    this.processing.set(`assign-${job.id}`);
    this.resetAutoLogoutTimer();

    this.shopFloorService.assignJob(job.id, worker.userId).subscribe({
      next: () => {
        this.processing.set(null);
        this.loadData();
        setTimeout(() => this.ephemeralLogout(), 800);
      },
      error: () => {
        this.processing.set(null);
      },
    });
  }

  protected skipJobSelect(): void {
    this.ephemeralLogout();
  }

  // ─── Drag & Drop (unassigned jobs → worker cards) ───

  protected onDragStart(event: DragEvent, job: ShopFloorJob): void {
    this.draggingJobId.set(job.id);
    event.dataTransfer!.effectAllowed = 'move';
    event.dataTransfer!.setData('application/x-job-id', String(job.id));
  }

  protected onDragEnd(): void {
    this.draggingJobId.set(null);
    this.dropTargetUserId.set(null);
  }

  protected onDragOverCard(event: DragEvent, worker: ClockWorker): void {
    if (!this.draggingJobId()) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dropTargetUserId.set(worker.userId);
  }

  protected onDragLeaveCard(): void {
    this.dropTargetUserId.set(null);
  }

  protected onDropCard(event: DragEvent, worker: ClockWorker): void {
    event.preventDefault();
    const jobIdStr = event.dataTransfer?.getData('application/x-job-id');
    this.dropTargetUserId.set(null);
    this.draggingJobId.set(null);

    if (!jobIdStr) return;
    const jobId = parseInt(jobIdStr, 10);
    if (isNaN(jobId)) return;

    this.processing.set(`assign-${jobId}`);
    this.shopFloorService.assignJob(jobId, worker.userId).subscribe({
      next: () => {
        this.processing.set(null);
        this.loadData();
      },
      error: () => {
        this.processing.set(null);
      },
    });
  }

  // ─── Job Timer Actions ───

  protected startJobTimer(assignment: { jobId: number }): void {
    if (this.processing()) return;
    this.processing.set(`timer-start-${assignment.jobId}`);
    this.resetAutoLogoutTimer();

    this.shopFloorService.startTimer(assignment.jobId).subscribe({
      next: () => {
        this.processing.set(null);
        this.loadData();
        this.showScanFeedback('Timer started');
      },
      error: () => {
        this.processing.set(null);
        this.showScanFeedback('Could not start timer');
      },
    });
  }

  protected completeJob(assignment: { jobId: number }): void {
    if (this.processing()) return;
    this.processing.set(`complete-${assignment.jobId}`);
    this.resetAutoLogoutTimer();

    this.shopFloorService.completeJob(assignment.jobId).subscribe({
      next: () => {
        this.processing.set(null);
        this.loadData();
        this.showScanFeedback('Job marked complete');
        setTimeout(() => this.ephemeralLogout(), 1200);
      },
      error: () => {
        this.processing.set(null);
        this.showScanFeedback('Could not complete job');
      },
    });
  }

  protected stopJobTimer(): void {
    if (this.processing()) return;
    this.processing.set('timer-stop');
    this.resetAutoLogoutTimer();

    this.shopFloorService.stopTimer().subscribe({
      next: () => {
        this.processing.set(null);
        this.loadData();
        this.showScanFeedback('Timer stopped');
      },
      error: () => {
        this.processing.set(null);
        this.showScanFeedback('Could not stop timer');
      },
    });
  }

  protected cancelActions(): void {
    this.ephemeralLogout();
  }

  // ─── Helpers ───

  protected isProcessing(workerId: number, eventType: string): boolean {
    return this.processing() === `${workerId}-${eventType}`;
  }

  protected hasFeedback(workerId: number): boolean {
    return this.actionFeedback()?.workerId === workerId;
  }

  protected feedbackSuccess(workerId: number): boolean {
    const fb = this.actionFeedback();
    return fb?.workerId === workerId && fb.success;
  }

  protected priorityClass(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'priority--urgent';
      case 'High': return 'priority--high';
      default: return '';
    }
  }

  // ─── Ephemeral Auth ───

  private ephemeralLogout(): void {
    this.clearAutoLogoutTimer();
    this.authService.clearAuth();
    this.loadData();
    this.resetToMain();
  }

  private resetToMain(): void {
    this.clearAutoLogoutTimer();
    this.authService.clearAuth();
    this.selectedWorker.set(null);
    this.scannedValue.set(null);
    this.pinError.set(null);
    this.pinControl.reset();
    this.processing.set(null);
    this.phase.set('main');
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

  // ─── Data ───

  private loadData(): void {
    forkJoin({
      overview: this.shopFloorService.getOverview(),
      workers: this.shopFloorService.getClockStatus(),
    }).subscribe({
      next: ({ overview, workers }) => {
        this.overview.set(overview);
        this.workers.set(workers);
        this.error.set(null);
      },
      error: () => this.error.set(this.translate.instant('shopFloor.loadFailed')),
    });
  }

  private updateClock(): void {
    this.clockDisplay.set(
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
    this.tick.update(t => t + 1);
  }

  private formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours >= 1) return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
    if (minutes >= 1) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
    return `${seconds}s`;
  }
}
