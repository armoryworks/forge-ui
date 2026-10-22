import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';

import { NotificationsComponent } from './notifications.component';
import { NotificationService } from '../../shared/services/notification.service';
import { UserPreferencesService } from '../../shared/services/user-preferences.service';
import { AppNotification } from '../../shared/models/app-notification.model';

describe('NotificationsComponent', () => {
  const row = (id: number, source: string): AppNotification => ({
    id, type: 'system', severity: 'info', source, title: `T${id}`, message: 'm',
    isRead: false, isPinned: false, isDismissed: false, createdAt: new Date('2026-10-01T00:00:00Z'),
  });

  let confirmDismissAll: ReturnType<typeof vi.fn>;
  let setPref: ReturnType<typeof vi.fn>;

  function create(query: Record<string, string> = {}, prefs: Record<string, unknown> = {}) {
    confirmDismissAll = vi.fn();
    setPref = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: NotificationService,
          useValue: {
            activeNotifications: signal([row(1, 'inventory'), row(2, 'sales_orders'), row(3, 'System'), row(4, 'system')]),
            filteredNotifications: signal([]),
            confirmDismissAll,
            markAllRead: vi.fn(),
          },
        },
        { provide: UserPreferencesService, useValue: { get: (k: string) => prefs[k] ?? null, set: setPref } },
        { provide: TranslateService, useValue: { instant: (k: string) => k } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    return TestBed.runInInjectionContext(() => new NotificationsComponent());
  }

  it('lists every active notification, not the bell panel subset', () => {
    expect(create().filteredNotifications().length).toBe(4);
  });

  it('offers the sources actually present, with readable labels', () => {
    const options = create().sourceOptions();
    expect(options[0].value).toBeNull();
    expect(options.slice(1).map(o => o.value).sort()).toEqual(['inventory', 'sales_orders', 'system']);
    expect(options.find(o => o.value === 'sales_orders')?.label).toBe('Sales orders');
    expect(options.find(o => o.value === 'system')?.label).toBe('notifications.sourceSystem');
  });

  it('uses the translated module name when one exists', () => {
    TestBed.overrideProvider(TranslateService, {
      useValue: { instant: (k: string) => k === 'notifications.sources.sales_orders' ? 'Órdenes de venta' : k },
    });
    const options = create().sourceOptions();
    expect(options.find(o => o.value === 'sales_orders')?.label).toBe('Órdenes de venta');
    expect(options.find(o => o.value === 'inventory')?.label).toBe('Inventory');
  });

  it('filters by the chosen source regardless of its stored case', () => {
    const page = create();
    page.sourceControl.setValue('system');
    expect(page.filteredNotifications().map(n => n.id)).toEqual([3, 4]);
  });

  it('asks before dismissing everything', () => {
    create().dismissAll();
    expect(confirmDismissAll).toHaveBeenCalled();
  });

  it('opens on the preferences tab when linked there', () => {
    expect(create({ tab: 'preferences' }).activeTab()).toBe('preferences');
  });

  it('sends the daily digest by default and lets the user turn it off', () => {
    const page = create();
    expect(page.emailDigestEnabled()).toBe(true);

    page.togglePref('email_digest', page.emailDigestEnabled());

    expect(setPref).toHaveBeenCalledWith('notif:email_digest', false);
    expect(page.emailDigestEnabled()).toBe(false);
  });

  it('shows a saved digest opt-out', () => {
    expect(create({}, { 'notif:email_digest': false }).emailDigestEnabled()).toBe(false);
  });
});
