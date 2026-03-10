export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderInitials: string;
  senderColor: string;
  recipientId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
  chatRoomId: number | null;
  fileAttachment: ChatFileAttachment | null;
  linkedEntityType: string | null;
  linkedEntityId: number | null;
}

export interface ChatFileAttachment {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}
