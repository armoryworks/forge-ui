import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { TranslatePipe } from '@ngx-translate/core';

import { LanguageToggleComponent } from '../../shared/components/language-toggle/language-toggle.component';

interface MobileAppTab {
  path: string;
  labelKey: string;
  icon: string;
  enabled: boolean;
}

/**
 * Native-shell chrome: top bar + five-tab bottom bar (Scan, Clock, Jobs,
 * Move, Lookup). Tabs unlock as their screens land; the set is later gated
 * per instance by the CAP-MOBILE-* capability flags.
 */
@Component({
  selector: 'app-mobile-app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, LanguageToggleComponent],
  templateUrl: './mobile-app-shell.component.html',
  styleUrl: './mobile-app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileAppShellComponent {
  protected readonly tabs: MobileAppTab[] = [
    { path: '/app/scan', labelKey: 'mobileApp.tabs.scan', icon: 'qr_code_scanner', enabled: true },
    { path: '/app/clock', labelKey: 'mobileApp.tabs.clock', icon: 'schedule', enabled: true },
    { path: '/app/jobs', labelKey: 'mobileApp.tabs.jobs', icon: 'work', enabled: true },
    { path: '/app/move', labelKey: 'mobileApp.tabs.move', icon: 'swap_horiz', enabled: true },
    { path: '/app/lookup', labelKey: 'mobileApp.tabs.lookup', icon: 'search', enabled: true },
  ];
}
