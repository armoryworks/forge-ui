import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { AppNotification } from '../../../shared/models/app-notification.model';
import { DesktopPreferenceService } from '../../../shared/services/desktop-preference.service';
import { LanguageService } from '../../../shared/services/language.service';
import { NotificationService } from '../../../shared/services/notification.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { MobileNotificationsComponent } from './mobile-notifications.component';

interface NotificationsInternals {
  formatTime(date: Date | string): string;
  open(notification: AppNotification): void;
}

describe('MobileNotificationsComponent', () => {
  let component: NotificationsInternals;
  const navigate = vi.fn();
  const markAsRead = vi.fn();
  const prefer = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        {
          provide: NotificationService,
          useValue: { filteredNotifications: signal([]), unreadCount: signal(0), load: vi.fn(), markAsRead },
        },
        { provide: Router, useValue: { navigate } },
        { provide: DesktopPreferenceService, useValue: { prefer } },
        { provide: SnackbarService, useValue: { error: vi.fn() } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {
      mobileLegacyPages: {
        notifications: {
          justNow: 'Ahora mismo',
          minutesAgo: 'hace {{count}} min',
          hoursAgo: 'hace {{count}} h',
          daysAgo: 'hace {{count}} d',
        },
      },
    });
    translate.use('es');
    TestBed.inject(LanguageService).currentLanguage.set('es');
    component = TestBed.runInInjectionContext(() => new MobileNotificationsComponent()) as unknown as NotificationsInternals;
  });

  const ago = (ms: number): Date => new Date(Date.now() - ms);

  it('says just now in the active language', () => {
    expect(component.formatTime(ago(10_000))).toBe('Ahora mismo');
  });

  it('formats minutes, hours and days in the active language', () => {
    expect(component.formatTime(ago(5 * 60_000))).toBe('hace 5 min');
    expect(component.formatTime(ago(3 * 3_600_000))).toBe('hace 3 h');
    expect(component.formatTime(ago(2 * 86_400_000))).toBe('hace 2 d');
  });

  it('formats older dates with the app language rather than the browser locale', () => {
    const old = new Date(2026, 0, 31);
    expect(component.formatTime(old)).toBe(old.toLocaleDateString('es'));
  });

  const notification = (entityType?: string, entityId?: number): AppNotification => ({
    id: 11, type: 'assignment', severity: 'info', source: 'system', title: 'T', message: 'M',
    isRead: false, isPinned: false, isDismissed: false, entityType, entityId, createdAt: new Date(),
  });

  it('opens a job notification in the mobile job page', () => {
    component.open(notification('Job', 42));

    expect(markAsRead).toHaveBeenCalledWith(11);
    expect(prefer).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/m/jobs', 42], { queryParams: undefined });
  });

  it('switches to the desktop site for a record the mobile shell has no page for', () => {
    prefer.mockReturnValue(true);

    component.open(notification('SalesOrder', 8));

    expect(markAsRead).toHaveBeenCalledWith(11);
    expect(prefer).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/sales-orders'], { queryParams: { id: 8 } });
  });

  it('only marks read when the notification points at nothing', () => {
    component.open(notification());

    expect(markAsRead).toHaveBeenCalledWith(11);
    expect(navigate).not.toHaveBeenCalled();
  });
});
