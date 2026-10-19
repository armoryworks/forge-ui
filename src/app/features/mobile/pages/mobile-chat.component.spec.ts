import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, ParamMap, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { BehaviorSubject, of } from 'rxjs';

import { AuthService } from '../../../shared/services/auth.service';
import { CapabilityService } from '../../../shared/services/capability.service';
import { ChatHubService } from '../../../shared/services/chat-hub.service';
import { SnackbarService } from '../../../shared/services/snackbar.service';
import { ChannelSelection } from '../../chat/components/chat-channel-list/chat-channel-list.component';
import { ChatConversation } from '../../chat/models/chat-conversation.model';
import { ChatRoom } from '../../chat/models/chat-room.model';
import { ChatService } from '../../chat/services/chat.service';
import { MobileChatComponent } from './mobile-chat.component';

interface MobileChatInternals {
  view: () => 'list' | 'dm' | 'channel';
  selectedChannel: () => ChatRoom | null;
  selectedConversation: () => ChatConversation | null;
  mutedChannelIds: () => Set<number>;
  pendingFile: { set(file: File | null): void };
  onChannelSelected(selection: ChannelSelection): void;
  onMessageSent(content: string): void;
  backToList(): void;
}

const CHANNEL = { id: 3, name: 'Floor', channelType: 'Group', isReadOnly: false, members: [{ userId: 1, isMuted: true }] } as unknown as ChatRoom;
const CONVERSATION = { userId: 8, userName: 'Ana', userInitials: 'A', userColor: '#000', unreadCount: 0 } as ChatConversation;

describe('MobileChatComponent', () => {
  let params: BehaviorSubject<ParamMap>;
  let navigate: ReturnType<typeof vi.fn>;
  let back: ReturnType<typeof vi.fn>;
  let chatService: Record<string, ReturnType<typeof vi.fn>>;
  let component: MobileChatInternals;

  beforeEach(() => {
    params = new BehaviorSubject(convertToParamMap({}));
    navigate = vi.fn((_: unknown[], extras: { queryParams: Record<string, unknown> }) => {
      params.next(convertToParamMap(extras.queryParams));
      return Promise.resolve(true);
    });
    back = vi.fn(() => params.next(convertToParamMap({})));
    chatService = {
      getConversations: vi.fn(() => of([CONVERSATION])),
      getChannels: vi.fn(() => of([CHANNEL])),
      getMessages: vi.fn(() => of([])),
      getChatRoomMessages: vi.fn(() => of([])),
      markAsRead: vi.fn(() => of(undefined)),
      markChannelRead: vi.fn(() => of(undefined)),
      sendMessage: vi.fn(() => of({ id: 1 })),
      sendChatRoomMessage: vi.fn(() => of({ id: 2 })),
      uploadChatFile: vi.fn(() => of({ id: 9 })),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: ChatService, useValue: chatService },
        { provide: ChatHubService, useValue: { connect: vi.fn(() => Promise.resolve()), onMessageReceived: vi.fn(), onRoomMessageReceived: vi.fn(), clearMessageCallbacks: vi.fn(), joinChannel: vi.fn(), leaveChannel: vi.fn() } },
        { provide: AuthService, useValue: { user: signal({ id: 1 }) } },
        { provide: CapabilityService, useValue: { isEnabled: () => true } },
        { provide: SnackbarService, useValue: { info: vi.fn(), errorFrom: vi.fn() } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: HttpClient, useValue: { get: vi.fn(() => of([])) } },
        { provide: Router, useValue: { navigate } },
        { provide: Location, useValue: { back } },
        { provide: ActivatedRoute, useValue: { queryParamMap: params } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new MobileChatComponent()) as unknown as MobileChatInternals;
  });

  it('puts the opened conversation in the URL so Back returns to the list', () => {
    component.onChannelSelected({ type: 'dm', conversationUserId: 8 });

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { dm: 8 }, replaceUrl: false }));
    expect(component.view()).toBe('dm');
    expect(component.selectedConversation()?.userName).toBe('Ana');

    params.next(convertToParamMap({}));

    expect(component.view()).toBe('list');
  });

  it('opens the channel named in the URL', () => {
    params.next(convertToParamMap({ channel: '3' }));

    expect(component.view()).toBe('channel');
    expect(component.selectedChannel()?.id).toBe(3);
  });

  it('falls back to the list for a channel the user cannot see', () => {
    params.next(convertToParamMap({ channel: '99' }));

    expect(component.view()).toBe('list');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {}, replaceUrl: true }));
  });

  it('pops the history entry it pushed when the header back button is used', () => {
    component.onChannelSelected({ type: 'channel', channelId: 3 });
    component.backToList();

    expect(back).toHaveBeenCalled();
    expect(component.view()).toBe('list');
  });

  it('replaces the URL instead of pushing when the conversation was deep-linked', () => {
    params.next(convertToParamMap({ dm: '8' }));
    navigate.mockClear();

    component.backToList();

    expect(back).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {}, replaceUrl: true }));
  });

  it('never uploads a file for a direct message', () => {
    params.next(convertToParamMap({ dm: '8' }));
    component.pendingFile.set(new File(['x'], 'a.pdf'));

    component.onMessageSent('hi');

    expect(chatService['uploadChatFile']).not.toHaveBeenCalled();
  });

  it('passes the muted channels to the list', () => {
    expect([...component.mutedChannelIds()]).toEqual([3]);
  });
});
