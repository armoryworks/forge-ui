import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../shared/services/auth.service';

interface MobileTab {
  path: string;
  label: string;
  icon: string;
  roles?: string[];
}

@Component({
  selector: 'app-mobile-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './mobile-layout.component.html',
  styleUrl: './mobile-layout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileLayoutComponent {
  private readonly authService = inject(AuthService);
  protected readonly router = inject(Router);

  protected readonly user = this.authService.user;

  private readonly allTabs: MobileTab[] = [
    { path: '/m/home', label: 'Home', icon: 'home' },
    { path: '/m/jobs', label: 'My Jobs', icon: 'work' },
    { path: '/m/clock', label: 'Clock', icon: 'schedule' },
    { path: '/m/scan', label: 'Scan', icon: 'qr_code_scanner' },
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

  protected logout(): void {
    this.authService.logout();
  }
}
