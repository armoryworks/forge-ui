import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ChatConversation } from '../../models/chat-conversation.model';
import { ChatRoom } from '../../models/chat-room.model';
import { ChannelSelection, ChatChannelListComponent } from './chat-channel-list.component';

interface ListInternals {
  selectConversation: (conversation: ChatConversation) => void;
  selectChannel: (channel: ChatRoom) => void;
  isActive: (type: 'dm' | 'channel', id: number) => boolean;
  channelSelected: { subscribe: (fn: (value: ChannelSelection) => void) => unknown };
}

describe('ChatChannelListComponent', () => {
  let list: ListInternals;
  let component: ChatChannelListComponent;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
    });
    component = TestBed.runInInjectionContext(() => new ChatChannelListComponent());
    list = component as unknown as ListInternals;
  });

  it('tapping a direct message selects that conversation for the page', () => {
    const selected: ChannelSelection[] = [];
    list.channelSelected.subscribe(value => selected.push(value));

    list.selectConversation({ userId: 8, userName: 'Kim, Alex' } as ChatConversation);

    expect(selected).toEqual([{ type: 'dm', conversationUserId: 8 }]);
  });

  it('tapping a channel selects that channel for the page', () => {
    const selected: ChannelSelection[] = [];
    list.channelSelected.subscribe(value => selected.push(value));

    list.selectChannel({ id: 3, name: 'Floor' } as ChatRoom);

    expect(selected).toEqual([{ type: 'channel', channelId: 3 }]);
  });

  it('marks the selected conversation and channel as active from the page inputs', () => {
    mockSignalInputs(component, { selectedUserId: 8, selectedChannelId: 3 });

    expect(list.isActive('dm', 8)).toBe(true);
    expect(list.isActive('channel', 3)).toBe(true);
    expect(list.isActive('channel', 8)).toBe(false);
  });
});
