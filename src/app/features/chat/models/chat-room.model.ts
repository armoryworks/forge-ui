export type ChannelType = 'DirectMessage' | 'Group' | 'TeamAuto' | 'Department' | 'Custom' | 'System' | 'Broadcast';
export type ChannelMemberRole = 'Member' | 'Admin' | 'Owner';

export interface ChatRoom {
  id: number;
  name: string;
  isGroup: boolean;
  createdById: number;
  createdAt: Date;
  members: ChatRoomMember[];
  channelType: ChannelType;
  description: string | null;
  teamId: number | null;
  isReadOnly: boolean;
  iconName: string | null;
  unreadCount: number;
  lastMessage: string | null;
  lastMessageAt: Date | null;
}

export interface ChatRoomMember {
  userId: number;
  displayName: string;
  initials: string;
  color: string;
  role: ChannelMemberRole;
  isMuted: boolean;
}

export interface CreateChannelRequest {
  name: string;
  channelType: ChannelType;
  description?: string;
  iconName?: string;
  memberIds: number[];
}

export interface UpdateChannelRequest {
  name?: string;
  description?: string;
  iconName?: string;
}
