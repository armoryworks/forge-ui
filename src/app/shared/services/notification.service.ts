import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { TranslateService } from '@ngx-translate/core';

import { environment } from '../../../environments/environment';
import { AppNotification } from '../models/app-notification.model';
import { NotificationFilter } from '../models/notification-filter.model';
import { NotificationTab } from '../models/notification-tab.type';
import { notificationOrigin } from '../utils/notification-origin';
import { ConfirmDialogComponent, ConfirmDialogData } from '../components/confirm-dialog/confirm-dialog.component';
import { SnackbarService } from './snackbar.service';
import { UserPreferencesService } from './user-preferences.service';
import { ChatNotificationService } from './chat-notification.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly translate = inject(TranslateService);
  private readonly snackbar = inject(SnackbarService);
  private readonly prefs = inject(UserPreferencesService);
  private readonly chime = inject(ChatNotificationService);

  private readonly _notifications = signal<AppNotification[]>([]);
  private readonly _panelOpen = signal(false);
  private readonly _filter = signal<NotificationFilter>({
    tab: 'all',
    unreadOnly: false,
  });

  readonly notifications = this._notifications.asReadonly();
  readonly panelOpen = this._panelOpen.asReadonly();
  readonly filter = this._filter.asReadonly();

  readonly unreadCount = computed(() =>
    this._notifications().filter(n => !n.isRead && !n.isDismissed).length
  );

  /**
   * Every notification that has not been dismissed, pinned first and newest first,
   * without the bell panel's tab and filter state.
   */
  readonly activeNotifications = computed(() =>
    this._notifications()
      .filter(n => !n.isDismissed)
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      })
  );

  readonly filteredNotifications = computed(() => {
    const f = this._filter();

    return this.activeNotifications().filter(n => {
      if (f.tab === 'messages' && notificationOrigin(n) !== 'user') return false;
      if (f.tab === 'alerts' && notificationOrigin(n) !== 'system') return false;
      if (f.source && n.source !== f.source) return false;
      if (f.severity && n.severity !== f.severity) return false;
      if (f.type && n.type !== f.type) return false;
      if (f.unreadOnly && n.isRead) return false;
      return true;
    });
  });

  /**
   * Load notifications from the API. Call on app init (after auth).
   */
  load(): void {
    this.http.get<{ data: AppNotification[] }>(`${environment.apiUrl}/notifications`).pipe(
      tap(res => this._notifications.set(res.data ?? [])),
      catchError(() => of({ data: [] })),
    ).subscribe();
  }

  /**
   * Add a notification from SignalR push. Hub payloads skip the HTTP date
   * interceptor, so `createdAt` is normalised to a Date here.
   */
  push(notification: AppNotification): void {
    const createdAt = notification.createdAt instanceof Date
      ? notification.createdAt
      : new Date(notification.createdAt as unknown as string);
    this._notifications.update(list => [{ ...notification, createdAt }, ...list]);
    if (this.prefs.get<boolean>('notif:sound') ?? true) this.chime.playChime();
  }

  togglePanel(): void {
    const opening = !this._panelOpen();
    this._panelOpen.set(opening);
    // Reload from API each time the panel opens so missed SignalR pushes are caught
    if (opening) this.load();
  }

  closePanel(): void {
    this._panelOpen.set(false);
  }

  setTab(tab: NotificationTab): void {
    this._filter.update(f => ({ ...f, tab }));
  }

  setFilter(partial: Partial<NotificationFilter>): void {
    this._filter.update(f => ({ ...f, ...partial }));
  }

  markAsRead(id: number): void {
    this.applyOptimistic(
      list => list.map(n => n.id === id ? { ...n, isRead: true } : n),
      () => this.http.patch(`${environment.apiUrl}/notifications/${id}`, { isRead: true }),
      'notifications.updateFailed',
    );
  }

  markAllRead(): void {
    this.applyOptimistic(
      list => list.map(n => ({ ...n, isRead: true })),
      () => this.http.post(`${environment.apiUrl}/notifications/mark-all-read`, {}),
      'notifications.updateFailed',
    );
  }

  dismiss(id: number): void {
    this.applyOptimistic(
      list => list.map(n => n.id === id ? { ...n, isDismissed: true } : n),
      () => this.http.patch(`${environment.apiUrl}/notifications/${id}`, { isDismissed: true }),
      'notifications.dismissFailed',
    );
  }

  dismissAll(): void {
    this.applyOptimistic(
      list => list.map(n => ({ ...n, isDismissed: true })),
      () => this.http.post(`${environment.apiUrl}/notifications/dismiss-all`, {}),
      'notifications.dismissFailed',
    );
  }

  /**
   * Asks before dismissing every notification, since dismissed notifications
   * cannot be brought back.
   */
  confirmDismissAll(): void {
    const count = this.activeNotifications().length;
    if (count === 0) return;
    this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: this.translate.instant('notifications.dismissAllConfirmTitle'),
        message: this.translate.instant('notifications.dismissAllConfirmMessage', { count }),
        confirmLabel: this.translate.instant('notifications.dismissAll'),
        severity: 'danger',
      } satisfies ConfirmDialogData,
    }).afterClosed().subscribe(confirmed => {
      if (confirmed) this.dismissAll();
    });
  }

  togglePin(id: number): void {
    const notification = this._notifications().find(n => n.id === id);
    if (!notification) return;

    const isPinned = !notification.isPinned;
    this.applyOptimistic(
      list => list.map(n => n.id === id ? { ...n, isPinned } : n),
      () => this.http.patch(`${environment.apiUrl}/notifications/${id}`, { isPinned }),
      'notifications.updateFailed',
    );
  }

  private applyOptimistic(
    change: (list: AppNotification[]) => AppNotification[],
    request: () => ReturnType<HttpClient['post']>,
    fallbackKey: string,
  ): void {
    const before = new Map(this._notifications().map(n => [n.id, n]));
    this._notifications.update(change);
    request().subscribe({
      error: (err: unknown) => {
        this._notifications.update(list => list.map(n => before.get(n.id) ?? n));
        this.snackbar.errorFrom(err, fallbackKey);
      },
    });
  }
}
