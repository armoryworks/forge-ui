import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NotificationService } from './notification.service';
import { AppNotification } from '../models/app-notification.model';
import { environment } from '../../../environments/environment';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpMock: HttpTestingController;

  const makeNotification = (overrides: Partial<AppNotification> = {}): AppNotification => ({
    id: 1,
    type: 'assignment',
    severity: 'info',
    source: 'system',
    title: 'Test',
    message: 'Test notification',
    isRead: false,
    isPinned: false,
    isDismissed: false,
    createdAt: new Date('2026-03-10T12:00:00Z'),
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(NotificationService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('initial state', () => {
    it('should have empty notifications', () => {
      expect(service.notifications()).toEqual([]);
    });

    it('should have panel closed', () => {
      expect(service.panelOpen()).toBe(false);
    });

    it('should have zero unread count', () => {
      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('push', () => {
    it('should add notification to the list', () => {
      const n = makeNotification({ id: 1 });
      service.push(n);

      expect(service.notifications().length).toBe(1);
      expect(service.notifications()[0].id).toBe(1);
    });

    it('should prepend new notifications', () => {
      service.push(makeNotification({ id: 1, title: 'First' }));
      service.push(makeNotification({ id: 2, title: 'Second' }));

      expect(service.notifications()[0].title).toBe('Second');
      expect(service.notifications()[1].title).toBe('First');
    });

    it('should increment unread count for unread notifications', () => {
      service.push(makeNotification({ id: 1, isRead: false }));
      service.push(makeNotification({ id: 2, isRead: false }));

      expect(service.unreadCount()).toBe(2);
    });

    it('should not increment unread count for read notifications', () => {
      service.push(makeNotification({ id: 1, isRead: true }));

      expect(service.unreadCount()).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should set the notification as read', () => {
      service.push(makeNotification({ id: 5, isRead: false }));

      service.markAsRead(5);

      expect(service.notifications()[0].isRead).toBe(true);

      const req = httpMock.expectOne(`${environment.apiUrl}/notifications/5`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ isRead: true });
      req.flush(null);
    });

    it('should decrement unread count', () => {
      service.push(makeNotification({ id: 1, isRead: false }));
      service.push(makeNotification({ id: 2, isRead: false }));

      expect(service.unreadCount()).toBe(2);

      service.markAsRead(1);

      expect(service.unreadCount()).toBe(1);

      httpMock.expectOne(`${environment.apiUrl}/notifications/1`).flush(null);
    });
  });

  describe('markAllRead', () => {
    it('should mark all notifications as read', () => {
      service.push(makeNotification({ id: 1, isRead: false }));
      service.push(makeNotification({ id: 2, isRead: false }));
      service.push(makeNotification({ id: 3, isRead: false }));

      service.markAllRead();

      expect(service.unreadCount()).toBe(0);
      expect(service.notifications().every(n => n.isRead)).toBe(true);

      const req = httpMock.expectOne(`${environment.apiUrl}/notifications/mark-all-read`);
      expect(req.request.method).toBe('POST');
      req.flush(null);
    });
  });

  describe('dismiss', () => {
    it('should mark the notification as dismissed', () => {
      service.push(makeNotification({ id: 10 }));

      service.dismiss(10);

      expect(service.notifications()[0].isDismissed).toBe(true);

      const req = httpMock.expectOne(`${environment.apiUrl}/notifications/10`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ isDismissed: true });
      req.flush(null);
    });

    it('should exclude dismissed notifications from filtered list', () => {
      service.push(makeNotification({ id: 1 }));
      service.push(makeNotification({ id: 2 }));

      service.dismiss(1);

      expect(service.filteredNotifications().length).toBe(1);
      expect(service.filteredNotifications()[0].id).toBe(2);

      httpMock.expectOne(`${environment.apiUrl}/notifications/1`).flush(null);
    });
  });

  describe('dismissAll', () => {
    it('should mark all notifications as dismissed', () => {
      service.push(makeNotification({ id: 1 }));
      service.push(makeNotification({ id: 2 }));

      service.dismissAll();

      expect(service.notifications().every(n => n.isDismissed)).toBe(true);
      expect(service.filteredNotifications().length).toBe(0);

      httpMock.expectOne(`${environment.apiUrl}/notifications/dismiss-all`).flush(null);
    });
  });

  describe('togglePanel', () => {
    it('should toggle panelOpen from false to true', () => {
      service.togglePanel();
      httpMock.expectOne(`${environment.apiUrl}/notifications`).flush({ data: [] });

      expect(service.panelOpen()).toBe(true);
    });

    it('should toggle panelOpen back to false', () => {
      service.togglePanel();
      httpMock.expectOne(`${environment.apiUrl}/notifications`).flush({ data: [] });
      service.togglePanel();

      expect(service.panelOpen()).toBe(false);
    });
  });

  describe('closePanel', () => {
    it('should set panelOpen to false', () => {
      service.togglePanel(); // open → triggers load()
      httpMock.expectOne(`${environment.apiUrl}/notifications`).flush({ data: [] });
      service.closePanel();

      expect(service.panelOpen()).toBe(false);
    });
  });

  describe('setTab', () => {
    it('should update the filter tab', () => {
      service.setTab('messages');

      expect(service.filter().tab).toBe('messages');
    });

    it('should change tab to alerts', () => {
      service.setTab('alerts');

      expect(service.filter().tab).toBe('alerts');
    });
  });

  describe('filteredNotifications', () => {
    it('should return all non-dismissed notifications on "all" tab', () => {
      service.push(makeNotification({ id: 1, source: 'system' }));
      service.push(makeNotification({ id: 2, source: 'user' }));

      service.setTab('all');

      expect(service.filteredNotifications().length).toBe(2);
    });

    it('should filter to user-source notifications on "messages" tab', () => {
      service.push(makeNotification({ id: 1, source: 'system' }));
      service.push(makeNotification({ id: 2, source: 'user' }));
      service.push(makeNotification({ id: 3, source: 'user' }));

      service.setTab('messages');

      expect(service.filteredNotifications().length).toBe(2);
      expect(service.filteredNotifications().every(n => n.source === 'user')).toBe(true);
    });

    it('should filter to system-source notifications on "alerts" tab', () => {
      service.push(makeNotification({ id: 1, source: 'system' }));
      service.push(makeNotification({ id: 2, source: 'user' }));
      service.push(makeNotification({ id: 3, source: 'system' }));

      service.setTab('alerts');

      expect(service.filteredNotifications().length).toBe(2);
      expect(service.filteredNotifications().every(n => n.source === 'system')).toBe(true);
    });

    it('should sort pinned notifications first', () => {
      service.push(makeNotification({ id: 1, isPinned: false, createdAt: new Date('2026-03-10T14:00:00Z') }));
      service.push(makeNotification({ id: 2, isPinned: true, createdAt: new Date('2026-03-10T10:00:00Z') }));

      const filtered = service.filteredNotifications();

      expect(filtered[0].id).toBe(2); // pinned, even though older
      expect(filtered[1].id).toBe(1);
    });

    it('should sort by date descending within same pin status', () => {
      service.push(makeNotification({ id: 1, createdAt: new Date('2026-03-10T08:00:00Z') }));
      service.push(makeNotification({ id: 2, createdAt: new Date('2026-03-10T12:00:00Z') }));
      service.push(makeNotification({ id: 3, createdAt: new Date('2026-03-10T10:00:00Z') }));

      const filtered = service.filteredNotifications();

      expect(filtered[0].id).toBe(2); // newest
      expect(filtered[1].id).toBe(3);
      expect(filtered[2].id).toBe(1); // oldest
    });

    it('should filter unread only when unreadOnly is set', () => {
      service.push(makeNotification({ id: 1, isRead: false }));
      service.push(makeNotification({ id: 2, isRead: true }));

      service.setFilter({ unreadOnly: true });

      expect(service.filteredNotifications().length).toBe(1);
      expect(service.filteredNotifications()[0].id).toBe(1);
    });
  });

  describe('togglePin', () => {
    it('should toggle pin status on a notification', () => {
      service.push(makeNotification({ id: 7, isPinned: false }));

      service.togglePin(7);

      expect(service.notifications()[0].isPinned).toBe(true);

      const req = httpMock.expectOne(`${environment.apiUrl}/notifications/7`);
      expect(req.request.body).toEqual({ isPinned: true });
      req.flush(null);
    });

    it('should unpin a pinned notification', () => {
      service.push(makeNotification({ id: 8, isPinned: true }));

      service.togglePin(8);

      expect(service.notifications()[0].isPinned).toBe(false);

      httpMock.expectOne(`${environment.apiUrl}/notifications/8`).flush(null);
    });

    it('should do nothing for non-existent notification id', () => {
      service.togglePin(999);

      httpMock.expectNone(`${environment.apiUrl}/notifications/999`);
    });
  });

  describe('load', () => {
    it('should fetch notifications from API and set them', () => {
      const notifications = [
        makeNotification({ id: 1 }),
        makeNotification({ id: 2 }),
      ];

      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/notifications`);
      expect(req.request.method).toBe('GET');
      req.flush({ data: notifications });

      expect(service.notifications().length).toBe(2);
    });

    it('should handle API error gracefully', () => {
      service.load();

      const req = httpMock.expectOne(`${environment.apiUrl}/notifications`);
      req.error(new ProgressEvent('error'));

      expect(service.notifications()).toEqual([]);
    });
  });
});
