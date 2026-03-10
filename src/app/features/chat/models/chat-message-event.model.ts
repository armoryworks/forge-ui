export interface ChatMessageEvent {
  id: number;
  senderId: number;
  senderName: string;
  senderInitials: string;
  senderColor: string;
  recipientId: number;
  content: string;
  createdAt: string;
}
