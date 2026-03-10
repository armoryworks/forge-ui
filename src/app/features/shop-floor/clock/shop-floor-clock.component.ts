import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { interval } from 'rxjs';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { InputComponent } from '../../../shared/components/input/input.component';
import { BarcodeScanInputComponent } from '../../../shared/components/barcode-scan-input/barcode-scan-input.component';
import { ShopFloorService } from '../services/shop-floor.service';
import { AuthService } from '../../../shared/services/auth.service';
import { ClockWorker } from '../models/clock-worker.model';

const REFRESH_INTERVAL_MS = 15_000;

type KioskPhase = 'scan' | 'pin' | 'clock';

@Component({
  selector: 'app-shop-floor-clock',
  standalone: true,
  imports: [ReactiveFormsModule, AvatarComponent, InputComponent, BarcodeScanInputComponent],
  templateUrl: './shop-floor-clock.component.html',
  styleUrl: './shop-floor-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopFloorClockComponent implements OnInit {
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workers = signal<ClockWorker[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly clockDisplay = signal('');
  protected readonly dateDisplay = signal('');
  protected readonly processing = signal<number | null>(null);

  protected readonly clockedIn = computed(() => this.workers().filter(w => w.isClockedIn));
  protected readonly clockedOut = computed(() => this.workers().filter(w => !w.isClockedIn));

  // Kiosk auth state
  protected readonly kioskPhase = signal<KioskPhase>('scan');
  protected readonly scannedBarcode = signal<string | null>(null);
  protected readonly kioskAuthError = signal<string | null>(null);
  protected readonly kioskAuthenticating = signal(false);
  protected readonly authenticatedWorker = signal<ClockWorker | null>(null);
  protected readonly pinControl = new FormControl('');

  ngOnInit(): void {
    this.loadData();
    this.updateClock();

    interval(REFRESH_INTERVAL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadData());

    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateClock());
  }

  protected onBarcodeScanned(barcode: string): void {
    this.scannedBarcode.set(barcode);
    this.kioskAuthError.set(null);
    this.pinControl.reset();
    this.kioskPhase.set('pin');
  }

  protected onPinSubmit(): void {
    const barcode = this.scannedBarcode();
    const pin = this.pinControl.value?.trim();
    if (!barcode || !pin || pin.length < 4) {
      this.kioskAuthError.set('PIN must be at least 4 digits.');
      return;
    }

    this.kioskAuthenticating.set(true);
    this.kioskAuthError.set(null);

    this.authService.kioskLogin(barcode, pin).subscribe({
      next: () => {
        this.kioskAuthenticating.set(false);
        // After successful auth, reload clock data and show clock phase
        this.loadData();
        this.kioskPhase.set('clock');

        // Auto-return to scan after 30 seconds of inactivity
        setTimeout(() => this.resetToScan(), 30_000);
      },
      error: () => {
        this.kioskAuthenticating.set(false);
        this.kioskAuthError.set('Invalid barcode or PIN. Please try again.');
      },
    });
  }

  protected cancelPin(): void {
    this.resetToScan();
  }

  protected resetToScan(): void {
    this.scannedBarcode.set(null);
    this.authenticatedWorker.set(null);
    this.kioskAuthError.set(null);
    this.pinControl.reset();
    this.kioskPhase.set('scan');
  }

  protected toggleClock(worker: ClockWorker): void {
    if (this.processing()) return;
    this.processing.set(worker.userId);

    const eventType = worker.isClockedIn ? 'ClockOut' : 'ClockIn';
    this.shopFloorService.clockInOut(worker.userId, eventType).subscribe({
      next: () => {
        this.processing.set(null);
        this.loadData();
      },
      error: () => {
        this.processing.set(null);
        this.error.set('Clock action failed. Please try again.');
        setTimeout(() => this.error.set(null), 5000);
      },
    });
  }

  protected formatTime(isoDate: string | null): string {
    if (!isoDate) return '';
    return new Date(isoDate).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });
  }

  private loadData(): void {
    this.shopFloorService.getClockStatus().subscribe({
      next: (data) => {
        this.workers.set(data);
        this.error.set(null);
      },
      error: () => this.error.set('Failed to load clock status'),
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
