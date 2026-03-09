import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { ThemeService } from '../../shared/services/theme.service';
import { NotificationService } from '../../shared/services/notification.service';
import { NotificationPanelComponent } from '../../shared/components/notification-panel/notification-panel.component';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [NotificationPanelComponent],
  templateUrl: './app-header.component.html',
  styleUrl: './app-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppHeaderComponent {
  private readonly themeService = inject(ThemeService);
  private readonly notificationService = inject(NotificationService);

  protected readonly themeIcon = computed(() =>
    this.themeService.theme() === 'light' ? 'dark_mode' : 'light_mode',
  );

  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly panelOpen = this.notificationService.panelOpen;

  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected toggleNotifications(): void {
    this.notificationService.togglePanel();
  }
}
