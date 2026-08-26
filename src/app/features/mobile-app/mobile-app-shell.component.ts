import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { CapabilityService } from '../../shared/services/capability.service';
import { CrashReportingService } from '../../shared/services/crash-reporting.service';
import { AppInfoService } from '../../shared/services/app-info.service';
import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';
import { SyncIndicatorComponent } from './components/sync-indicator/sync-indicator.component';

interface MobileAppTab {
  path: string;
  labelKey: string;
  icon: string;
  capability: string;
}

/**
 * Native-shell chrome: top bar + five-tab bottom bar (Scan, Clock, Jobs,
 * Move, Lookup), each tab shown only while its CAP-MOBILE-* flag is on for
 * this instance. Account lives behind the gear, never a tab.
 */
@Component({
  selector: 'app-mobile-app-shell',
  standalone: true,
  imports: [SyncIndicatorComponent, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageToggleComponent],
  templateUrl: './mobile-app-shell.component.html',
  styleUrl: './mobile-app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileAppShellComponent {
  private readonly capabilities = inject(CapabilityService);
  private readonly crash = inject(CrashReportingService);
  private readonly appInfo = inject(AppInfoService);

  private readonly allTabs: MobileAppTab[] = [
    { path: '/app/scan', labelKey: 'mobileApp.tabs.scan', icon: 'qr_code_scanner', capability: 'CAP-MOBILE-SCAN' },
    { path: '/app/clock', labelKey: 'mobileApp.tabs.clock', icon: 'schedule', capability: 'CAP-MOBILE-CLOCK' },
    { path: '/app/jobs', labelKey: 'mobileApp.tabs.jobs', icon: 'work', capability: 'CAP-MOBILE-JOBS' },
    { path: '/app/move', labelKey: 'mobileApp.tabs.move', icon: 'swap_horiz', capability: 'CAP-MOBILE-STOCK' },
    { path: '/app/lookup', labelKey: 'mobileApp.tabs.lookup', icon: 'search', capability: 'CAP-MOBILE-LOOKUP' },
  ];

  protected readonly tabs = computed(() =>
    this.allTabs.filter((tab) => this.capabilities.isEnabled(tab.capability, true)));

  constructor() {
    void this.appInfo.load();
    void this.crash.init();
  }
}
