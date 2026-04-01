export interface ChatRoom {
  id: number;
  name: string;
  isGroup: boolean;
  createdById: number;
  createdAt: Date;
  members: ChatRoomMember[];
}

export interface ChatRoomMember {
  userId: number;
  displayName: string;
  initials: string;
  color: string;
}
