import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { NotificationService } from '../../../shared/services/notification.service';
import { MobileNotificationsComponent } from './mobile-notifications.component';

interface NotificationsInternals {
  formatTime(date: Date | string): string;
}

describe('MobileNotificationsComponent', () => {
  let component: NotificationsInternals;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        {
          provide: NotificationService,
          useValue: { filteredNotifications: signal([]), unreadCount: signal(0), load: vi.fn() },
        },
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
});
