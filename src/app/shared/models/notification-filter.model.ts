import { AppNotification } from './app-notification.model';
import { NotificationTab } from './notification-tab.type';

export interface NotificationFilter {
  tab: NotificationTab;
  source?: string;
  severity?: AppNotification['severity'];
  type?: AppNotification['type'];
  unreadOnly: boolean;
}
