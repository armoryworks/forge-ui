import { describe, expect, it } from 'vitest';

import { ChatRoom } from '../models/chat-room.model';
import { mutedChannelIds } from './chat-rooms';

const room = (id: number, members: { userId: number; isMuted: boolean }[]) => ({ id, members } as unknown as ChatRoom);

describe('mutedChannelIds', () => {
  it('collects only the channels the user muted', () => {
    const rooms = [
      room(1, [{ userId: 5, isMuted: true }]),
      room(2, [{ userId: 5, isMuted: false }]),
      room(3, [{ userId: 6, isMuted: true }]),
    ];

    expect([...mutedChannelIds(rooms, 5)]).toEqual([1]);
  });

  it('is empty without a user', () => {
    expect(mutedChannelIds([room(1, [{ userId: 5, isMuted: true }])], null).size).toBe(0);
  });
});
