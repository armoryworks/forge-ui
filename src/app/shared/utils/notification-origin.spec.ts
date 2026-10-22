import { humanizeNotificationSource, notificationOrigin } from './notification-origin';

describe('notificationOrigin', () => {
  it('treats module-tagged rows as system alerts', () => {
    for (const source of ['inventory', 'sales_orders', 'maintenance-overdue', 'Jobs', 'system']) {
      expect(notificationOrigin({ source, type: 'system' })).toBe('system');
    }
  });

  it('treats mentions, messages and rows with a sender as from people', () => {
    expect(notificationOrigin({ source: 'jobs', type: 'mention' })).toBe('user');
    expect(notificationOrigin({ source: 'chat', type: 'message' })).toBe('user');
    expect(notificationOrigin({ source: 'jobs', type: 'assignment', senderInitials: 'AB' })).toBe('user');
    expect(notificationOrigin({ source: 'user', type: 'system' })).toBe('user');
  });
});

describe('humanizeNotificationSource', () => {
  it('turns module tags into readable labels', () => {
    expect(humanizeNotificationSource('sales_orders')).toBe('Sales orders');
    expect(humanizeNotificationSource('maintenance-overdue')).toBe('Maintenance overdue');
    expect(humanizeNotificationSource('Jobs')).toBe('Jobs');
    expect(humanizeNotificationSource('timeTracking')).toBe('Time tracking');
  });
});
