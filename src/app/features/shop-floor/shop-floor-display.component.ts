import {
  ChangeDetectionStrategy, Component, computed, DestroyRef, HostBinding, inject, OnInit, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AvatarComponent } from '../../shared/components/avatar/avatar.component';
import { KioskSearchBarComponent } from './components/kiosk-search-bar/kiosk-search-bar.component';
import { ShopFloorService } from './services/shop-floor.service';
import { ShopFloorOverview } from './models/shop-floor-overview.model';

const REFRESH_INTERVAL_MS = 30_000;

@Component({
  selector: 'app-shop-floor-display',
  standalone: true,
  imports: [TranslatePipe, AvatarComponent, KioskSearchBarComponent],
  templateUrl: './shop-floor-display.component.html',
  styleUrl: './shop-floor-display.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShopFloorDisplayComponent implements OnInit {
  // Force light theme on kiosk display regardless of user's dark mode preference
  @HostBinding('attr.data-theme') readonly dataTheme = 'light';

  private readonly shopFloorService = inject(ShopFloorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translate = inject(TranslateService);

  protected readonly data = signal<ShopFloorOverview | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly lastUpdated = signal<Date | null>(null);

  protected readonly workers = computed(() => this.data()?.workers ?? []);
  protected readonly activeJobs = computed(() => this.data()?.activeJobs ?? []);
  protected readonly completedToday = computed(() => this.data()?.completedToday ?? 0);
  protected readonly maintenanceAlerts = computed(() => this.data()?.maintenanceAlerts ?? 0);
  protected readonly clockDisplay = signal('');

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

  private loadData(): void {
    this.shopFloorService.getOverview().subscribe({
      next: (data) => {
        this.data.set(data);
        this.lastUpdated.set(new Date());
        this.error.set(null);
      },
      error: () => this.error.set(this.translate.instant('shopFloor.loadFailed')),
    });
  }

  private updateClock(): void {
    this.clockDisplay.set(
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    );
  }

  protected priorityClass(priority: string): string {
    switch (priority) {
      case 'Urgent': return 'priority--urgent';
      case 'High': return 'priority--high';
      default: return '';
    }
  }
}
