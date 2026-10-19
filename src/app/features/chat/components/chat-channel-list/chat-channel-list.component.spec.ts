import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { mockSignalInputs } from '../../../../../testing/signal-input-harness';
import { ChatConversation } from '../../models/chat-conversation.model';
import { ChatRoom } from '../../models/chat-room.model';
import { ChannelSelection, ChatChannelListComponent } from './chat-channel-list.component';

const ROOM: ChatRoom = {
  id: 7,
  name: 'Floor',
  isGroup: true,
  createdById: 1,
  createdAt: new Date(2026, 9, 1),
  members: [],
  channelType: 'Group',
  description: null,
  teamId: null,
  isReadOnly: false,
  iconName: null,
  unreadCount: 0,
  lastMessage: null,
  lastMessageAt: null,
};

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

describe('ChatChannelListComponent channel rows', () => {
  let fixture: ComponentFixture<ChatChannelListComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ChatChannelListComponent, TranslateModule.forRoot()],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(ChatChannelListComponent);
    fixture.componentRef.setInput('channels', [ROOM]);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('keeps the mute button beside the channel button, not inside it', () => {
    const mute = el.querySelector('.channel-list__mute-btn') as HTMLButtonElement;

    expect(mute).not.toBeNull();
    expect(mute.parentElement?.closest('button')).toBeNull();
    expect(el.querySelector('button button')).toBeNull();
    expect(mute.parentElement?.getAttribute('role')).toBe('listitem');
  });

  it('mutes without opening the channel', () => {
    const opened: ChannelSelection[] = [];
    const muted: boolean[] = [];
    fixture.componentInstance.channelSelected.subscribe(r => opened.push(r));
    fixture.componentInstance.muteToggled.subscribe(e => muted.push(e.mute));

    (el.querySelector('.channel-list__mute-btn') as HTMLButtonElement).click();

    expect(muted).toEqual([true]);
    expect(opened).toEqual([]);
  });
});

describe('ChatChannelListComponent actions and search', () => {
  let fixture: ComponentFixture<ChatChannelListComponent>;
  let el: HTMLElement;

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ChatChannelListComponent, TranslateModule.forRoot()],
      providers: [provideNoopAnimations()],
    });
    fixture = TestBed.createComponent(ChatChannelListComponent);
    el = fixture.nativeElement as HTMLElement;
  });

  it('keeps New Message, New Channel and Browse when there are no conversations or channels', () => {
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="chat-new-message-btn"]')).not.toBeNull();
    expect(el.textContent).toContain('chat.channelList.newChannel');
    expect(el.textContent).toContain('chat.channelList.browseChannels');
  });

  it('emits newMessageClicked from the New Message button', () => {
    let clicks = 0;
    fixture.componentInstance.newMessageClicked.subscribe(() => clicks++);
    fixture.detectChanges();

    (el.querySelector('[data-testid="chat-new-message-btn"]') as HTMLButtonElement).click();

    expect(clicks).toBe(1);
  });

  it('hides New Message when direct messages cannot be started', () => {
    fixture.componentRef.setInput('canStartDirectMessage', false);
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="chat-new-message-btn"]')).toBeNull();
  });

  it('matches names regardless of accents', () => {
    fixture.componentRef.setInput('channels', [{ ...ROOM, name: 'Producción' }]);
    fixture.componentRef.setInput('searchTerm', 'produccion');
    fixture.detectChanges();

    expect(el.textContent).toContain('Producción');
    expect(el.textContent).not.toContain('chat.channelList.noResults');
  });

  it('shows the muted marker with a translated tooltip key for muted channels', () => {
    fixture.componentRef.setInput('channels', [ROOM]);
    fixture.componentRef.setInput('mutedChannelIds', new Set([ROOM.id]));
    fixture.detectChanges();

    expect(el.querySelector('.channel-list__muted-icon')).not.toBeNull();
  });
});
