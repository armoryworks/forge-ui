export interface AppNotification {
  id: number;
  type: 'assignment' | 'overdue' | 'expense' | 'maintenance' | 'system' | 'message' | 'mention';
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
  createdAt: Date;
}
