import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '../../shared/services/auth.service';
import { MobileClockStateService } from './services/mobile-clock-state.service';

interface MobileTab {
  path: string;
  label: string;
  icon: string;
  roles?: string[];
  requiresClockedIn?: boolean;
  isScan?: boolean;
}

@Component({
  selector: 'app-mobile-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './mobile-layout.component.html',
  styleUrl: './mobile-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  protected readonly router = inject(Router);
  protected readonly clockState = inject(MobileClockStateService);

  protected readonly user = this.authService.user;
  protected readonly isClockedIn = this.clockState.isClockedIn;
  protected readonly clockCheckDone = this.clockState.checkDone;

  private readonly allTabs: MobileTab[] = [
    { path: '/m/chat', label: 'Chat', icon: 'chat' },
    { path: '/m/jobs', label: 'My Jobs', icon: 'work', requiresClockedIn: true },
    { path: '/m/scan', label: 'Scan', icon: 'qr_code_scanner', isScan: true, requiresClockedIn: true },
    { path: '/m/clock', label: 'Clock', icon: 'schedule' },
    { path: '/m/account', label: 'Account', icon: 'person' },
  ];

  protected readonly tabs = computed(() => {
    const user = this.user();
    if (!user) return [];

    return this.allTabs.filter(tab => {
      if (!tab.roles) return true;
      return tab.roles.some(r => user.roles?.includes(r));
    });
  });

  constructor() {
    // Redirect away from gated pages if not clocked in
    effect(() => {
      const clockedIn = this.isClockedIn();
      const done = this.clockCheckDone();
      if (!done) return;

      if (!clockedIn) {
        const url = this.router.url;
        const gatedPaths = ['/m/jobs', '/m/scan'];
        if (gatedPaths.some(p => url.startsWith(p))) {
          this.router.navigate(['/m/clock']);
        }
      }
    });
  }

  ngOnInit(): void {
    this.checkClockStatus();
  }

  protected isTabDisabled(tab: MobileTab): boolean {
    return !!tab.requiresClockedIn && !this.isClockedIn();
  }

  protected onTabClick(event: Event, tab: MobileTab): void {
    if (this.isTabDisabled(tab)) {
      event.preventDefault();
    }
  }

  private checkClockStatus(): void {
    const userId = this.user()?.id;
    if (!userId) {
      this.clockState.update(false);
      return;
    }

    this.http.get<{ isClockedIn: boolean }>('/api/v1/time-tracking/clock-status').subscribe({
      next: (status) => {
        this.clockState.update(status.isClockedIn);

        // If not clocked in, redirect to clock page
        if (!status.isClockedIn) {
          const url = this.router.url;
          if (url === '/m' || url === '/m/' || url === '/m/chat') {
            this.router.navigate(['/m/clock']);
          }
        }
      },
      error: () => {
        this.clockState.update(false);
      },
    });
  }

  protected logout(): void {
    this.authService.logout();
  }
}
