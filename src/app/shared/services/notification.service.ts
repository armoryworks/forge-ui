import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AppNotification, NotificationFilter, NotificationTab } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly http = inject(HttpClient);

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

  readonly filteredNotifications = computed(() => {
    const all = this._notifications();
    const f = this._filter();

    return all.filter(n => {
      if (n.isDismissed) return false;

      // Tab filter
      if (f.tab === 'messages' && n.source !== 'user') return false;
      if (f.tab === 'alerts' && n.source !== 'system') return false;

      // Additional filters
      if (f.source && n.source !== f.source) return false;
      if (f.severity && n.severity !== f.severity) return false;
      if (f.type && n.type !== f.type) return false;
      if (f.unreadOnly && n.isRead) return false;

      return true;
    }).sort((a, b) => {
      // Pinned first, then by date
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
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
   * Add a notification from SignalR push.
   */
  push(notification: AppNotification): void {
    this._notifications.update(list => [notification, ...list]);
  }

  togglePanel(): void {
    this._panelOpen.update(v => !v);
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
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
    this.http.patch(`${environment.apiUrl}/notifications/${id}`, { isRead: true })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  markAllRead(): void {
    this._notifications.update(list =>
      list.map(n => ({ ...n, isRead: true }))
    );
    this.http.post(`${environment.apiUrl}/notifications/mark-all-read`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  dismiss(id: number): void {
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, isDismissed: true } : n)
    );
    this.http.patch(`${environment.apiUrl}/notifications/${id}`, { isDismissed: true })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  dismissAll(): void {
    this._notifications.update(list =>
      list.map(n => ({ ...n, isDismissed: true }))
    );
    this.http.post(`${environment.apiUrl}/notifications/dismiss-all`, {})
      .pipe(catchError(() => of(null)))
      .subscribe();
  }

  togglePin(id: number): void {
    const notification = this._notifications().find(n => n.id === id);
    if (!notification) return;

    const isPinned = !notification.isPinned;
    this._notifications.update(list =>
      list.map(n => n.id === id ? { ...n, isPinned } : n)
    );
    this.http.patch(`${environment.apiUrl}/notifications/${id}`, { isPinned })
      .pipe(catchError(() => of(null)))
      .subscribe();
  }
}
