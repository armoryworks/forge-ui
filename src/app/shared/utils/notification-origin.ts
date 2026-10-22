import { AppNotification } from '../models/app-notification.model';

export type NotificationOrigin = 'user' | 'system';

const PERSONAL_TYPES = new Set<AppNotification['type']>(['message', 'mention']);

/**
 * Whether a notification came from a person or from the system. The API's `source` is the
 * writing module's tag (inventory, sales_orders, ...), so it cannot decide this on its own:
 * a sender or a personal type marks a message from a person, everything else is an alert.
 */
export function notificationOrigin(n: Pick<AppNotification, 'source' | 'type' | 'senderInitials'>): NotificationOrigin {
  if (n.source === 'user' || !!n.senderInitials || PERSONAL_TYPES.has(n.type)) return 'user';
  return 'system';
}

/** Turns a module tag such as `sales_orders` or `maintenance-overdue` into `Sales orders` / `Maintenance overdue`. */
export function humanizeNotificationSource(source: string): string {
  const words = source.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : source;
}
