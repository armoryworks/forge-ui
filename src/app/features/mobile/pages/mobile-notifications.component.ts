import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RichTextPipe } from '../../../shared/pipes/rich-text.pipe';
import { LanguageService } from '../../../shared/services/language.service';
import { AppNotification } from '../../../shared/models/app-notification.model';
import { NotificationService } from '../../../shared/services/notification.service';
import { MobileEntityLinkService } from '../services/mobile-entity-link.service';

@Component({
  selector: 'app-mobile-notifications',
  standalone: true,
  imports: [TranslatePipe, AvatarComponent, EmptyStateComponent, RichTextPipe],
  templateUrl: './mobile-notifications.component.html',
  styleUrl: './mobile-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);
  private readonly translate = inject(TranslateService);
  private readonly languageService = inject(LanguageService);
  private readonly entityLinks = inject(MobileEntityLinkService);

  protected readonly notifications = this.notificationService.filteredNotifications;
  protected readonly rows = computed(() => this.notifications().map((notification) => ({
    notification,
    target: this.entityLinks.targetFor(notification.entityType, notification.entityId),
  })));
  protected readonly unreadCount = this.notificationService.unreadCount;

  ngOnInit(): void {
    this.notificationService.load();
  }

  protected open(notification: AppNotification): void {
    this.notificationService.markAsRead(notification.id);
    const target = this.entityLinks.targetFor(notification.entityType, notification.entityId);
    if (target) this.entityLinks.open(target);
  }

  protected markAllRead(): void {
    this.notificationService.markAllRead();
  }

  protected dismiss(id: number, event: Event): void {
    event.stopPropagation();
    this.notificationService.dismiss(id);
  }

  protected formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return this.translate.instant('mobileLegacyPages.notifications.justNow');
    if (minutes < 60) return this.translate.instant('mobileLegacyPages.notifications.minutesAgo', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return this.translate.instant('mobileLegacyPages.notifications.hoursAgo', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 7) return this.translate.instant('mobileLegacyPages.notifications.daysAgo', { count: days });
    return d.toLocaleDateString(this.languageService.currentLanguage());
  }

  protected getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }
}
