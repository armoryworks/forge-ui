import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { ShopFloorService } from '../services/shop-floor.service';
import { ClockWorker } from '../models/clock-worker.model';

const REFRESH_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-shop-floor-clock',
  standalone: true,
  imports: [AvatarComponent],
  templateUrl: './shop-floor-clock.component.html',
  styleUrl: './shop-floor-clock.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopFloorClockComponent implements OnInit {
  private readonly shopFloorService = inject(ShopFloorService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workers = signal<ClockWorker[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly clockDisplay = signal('');
  protected readonly dateDisplay = signal('');
  protected readonly processing = signal<number | null>(null);

  protected readonly clockedIn = computed(() => this.workers().filter(w => w.isClockedIn));
  protected readonly clockedOut = computed(() => this.workers().filter(w => !w.isClockedIn));

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
