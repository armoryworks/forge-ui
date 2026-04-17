export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderInitials: string;
  senderColor: string;
  recipientId: number;
  content: string;
  isRead: boolean;
  createdAt: Date;
  chatRoomId: number | null;
  fileAttachment: ChatFileAttachment | null;
  linkedEntityType: string | null;
  linkedEntityId: number | null;
  parentMessageId: number | null;
  threadReplyCount: number;
  threadLastReplyAt: Date | null;
  mentions: ChatMessageMention[];
}

export interface ChatMessageMention {
  entityType: string;
  entityId: number;
  displayText: string;
}

export interface ChatFileAttachment {
  id: number;
  fileName: string;
  contentType: string;
  size: number;
  url: string;
}
