export interface AppNotification {
  id: number;
  type: 'assignment' | 'overdue' | 'expense' | 'maintenance' | 'system' | 'message';
  severity: 'info' | 'warning' | 'critical';
  source: 'user' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  isPinned: boolean;
  isDismissed: boolean;
  entityType?: string;
  entityId?: number;
  senderInitials?: string;
  senderColor?: string;
  createdAt: string;
}

export type NotificationTab = 'all' | 'messages' | 'alerts';

export interface NotificationFilter {
  tab: NotificationTab;
  source?: 'user' | 'system';
  severity?: AppNotification['severity'];
  type?: AppNotification['type'];
  unreadOnly: boolean;
}
