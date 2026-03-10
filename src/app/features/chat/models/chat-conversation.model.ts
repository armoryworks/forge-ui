export interface ChatConversation {
  userId: number;
  userName: string;
  userInitials: string;
  userColor: string;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}
