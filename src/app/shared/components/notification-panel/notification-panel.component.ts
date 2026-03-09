import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe } from '@angular/common';

import { NotificationService } from '../../services/notification.service';
import { AvatarComponent } from '../avatar/avatar.component';
import { AppNotification, NotificationTab } from '../../models/notification.model';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [DatePipe, AvatarComponent],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanelComponent {
  private readonly notificationService = inject(NotificationService);
  private readonly router = inject(Router);

  protected readonly notifications = this.notificationService.filteredNotifications;
  protected readonly filter = this.notificationService.filter;
  protected readonly unreadCount = this.notificationService.unreadCount;
  protected readonly isEmpty = computed(() => this.notifications().length === 0);

  protected readonly tabs: { key: NotificationTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'messages', label: 'Messages' },
    { key: 'alerts', label: 'Alerts' },
  ];

  protected setTab(tab: NotificationTab): void {
    this.notificationService.setTab(tab);
  }

  protected markAllRead(): void {
    this.notificationService.markAllRead();
  }

  protected dismissAll(): void {
    this.notificationService.dismissAll();
  }

  protected onNotificationClick(notification: AppNotification): void {
    this.notificationService.markAsRead(notification.id);
    if (notification.entityType && notification.entityId) {
      this.notificationService.closePanel();
      this.router.navigate(['/', notification.entityType, notification.entityId]);
    }
  }

  protected togglePin(notification: AppNotification, event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.togglePin(notification.id);
  }

  protected dismiss(notification: AppNotification, event: MouseEvent): void {
    event.stopPropagation();
    this.notificationService.dismiss(notification.id);
  }

  protected getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }
}
