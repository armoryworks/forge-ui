export interface AppNotification {
  id: number;
  type: 'assignment' | 'overdue' | 'expense' | 'maintenance' | 'system' | 'message' | 'mention' | 'event_invite' | 'leave';
  severity: 'info' | 'warning' | 'critical';
  source: string;
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
