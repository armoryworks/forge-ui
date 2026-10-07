import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AuthService } from '../../shared/services/auth.service';
import { CapabilityService } from '../../shared/services/capability.service';
import { DesktopPreferenceService } from '../../shared/services/desktop-preference.service';
import { SnackbarService } from '../../shared/services/snackbar.service';
import { MobileClockStateService } from './services/mobile-clock-state.service';

interface MobileTab {
  path: string;
  label: string;
  icon: string;
  roles?: string[];
  capability?: string;
  requiresClockedIn?: boolean;
  isScan?: boolean;
}

@Component({
  selector: 'app-mobile-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './mobile-layout.component.html',
  styleUrl: './mobile-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileLayoutComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly capabilities = inject(CapabilityService);
  private readonly desktopPreference = inject(DesktopPreferenceService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackbar = inject(SnackbarService);
  private readonly translate = inject(TranslateService);
  protected readonly router = inject(Router);
  protected readonly clockState = inject(MobileClockStateService);

  protected readonly user = this.authService.user;
  protected readonly isClockedIn = this.clockState.isClockedIn;
  protected readonly clockCheckDone = this.clockState.checkDone;
  protected readonly desktopReturnUrl = signal<string | null>(null);

  private readonly allTabs: MobileTab[] = [
    { path: '/m/chat', label: 'Chat', icon: 'chat' },
    { path: '/m/jobs', label: 'My Jobs', icon: 'work', requiresClockedIn: true },
    { path: '/m/scan', label: 'Scan', icon: 'qr_code_scanner', isScan: true, requiresClockedIn: true, capability: 'CAP-MFG-SHOPFLOOR' },
    { path: '/m/clock', label: 'Clock', icon: 'schedule' },
    { path: '/m/account', label: 'Account', icon: 'person' },
  ];

  protected readonly tabs = computed(() => {
    const user = this.user();
    if (!user) return [];

    return this.allTabs.filter(tab => {
      if (tab.capability && !this.capabilities.isEnabled(tab.capability, true)) return false;
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
    this.desktopPreference.clear();
    this.desktopReturnUrl.set(desktopUrl(this.route.snapshot.queryParamMap.get('returnUrl')));
    this.checkClockStatus();
  }

  protected openOnDesktop(): void {
    const url = this.desktopReturnUrl();
    if (!url) return;
    if (!this.desktopPreference.prefer()) {
      this.snackbar.error(this.translate.instant('mobileWeb.desktopLink.storageBlocked'));
      return;
    }
    this.router.navigateByUrl(url);
  }

  protected dismissDesktopLink(): void {
    this.desktopReturnUrl.set(null);
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

        // If not clocked in, redirect to clock page (but not from chat — chat is always accessible)
        if (!status.isClockedIn) {
          const url = this.router.url;
          if (url === '/m' || url === '/m/') {
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

function desktopUrl(returnUrl: string | null): string | null {
  if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) return null;
  if (/^\/m(\/|\?|#|$)/.test(returnUrl)) return null;
  return returnUrl;
}
