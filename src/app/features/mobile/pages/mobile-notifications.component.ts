import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';

import { AvatarComponent } from '../../../shared/components/avatar/avatar.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { NotificationService } from '../../../shared/services/notification.service';

@Component({
  selector: 'app-mobile-notifications',
  standalone: true,
  imports: [AvatarComponent, EmptyStateComponent],
  templateUrl: './mobile-notifications.component.html',
  styleUrl: './mobile-notifications.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNotificationsComponent implements OnInit {
  private readonly notificationService = inject(NotificationService);

  protected readonly notifications = this.notificationService.filteredNotifications;
  protected readonly unreadCount = this.notificationService.unreadCount;

  ngOnInit(): void {
    this.notificationService.load();
  }

  protected markAsRead(id: number): void {
    this.notificationService.markAsRead(id);
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

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  }

  protected getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      default: return 'info';
    }
  }
}
