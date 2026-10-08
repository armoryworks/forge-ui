export interface ActivityItem {
  id: number;
  description: string;
  createdAt: Date;
  userInitials?: string;
  userName?: string;
  userColor?: string;
  action?: string;
}
