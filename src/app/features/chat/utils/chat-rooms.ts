import { ChatRoom } from '../models/chat-room.model';

export function mutedChannelIds(channels: readonly ChatRoom[], userId: number | null | undefined): Set<number> {
  return new Set(
    channels
      .filter(c => c.members.some(m => m.userId === userId && m.isMuted))
      .map(c => c.id),
  );
}
