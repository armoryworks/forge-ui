import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';
import { of } from 'rxjs';

import { ChatComponent } from './chat.component';
import { ChatService } from './services/chat.service';
import { ChatBroadcastService } from './services/chat-broadcast.service';
import { ChatHubService } from '../../shared/services/chat-hub.service';
import { AuthService } from '../../shared/services/auth.service';
import { ChatRoom } from './models/chat-room.model';

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

describe('ChatComponent channel rows', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let el: HTMLElement;
  let chatService: { getConversations: ReturnType<typeof vi.fn>; getChannels: ReturnType<typeof vi.fn>; muteChannel: ReturnType<typeof vi.fn> } & Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    chatService = {
      getConversations: vi.fn(() => of([])),
      getChannels: vi.fn(() => of([ROOM])),
      muteChannel: vi.fn(() => of(undefined)),
      getMessages: vi.fn(() => of([])),
      getChatRoomMessages: vi.fn(() => of([])),
      markAsRead: vi.fn(() => of(undefined)),
      markChannelRead: vi.fn(() => of(undefined)),
    };
    TestBed.configureTestingModule({
      imports: [ChatComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ChatService, useValue: chatService },
        { provide: ChatHubService, useValue: { connect: vi.fn(() => Promise.resolve()), onMessageReceived: vi.fn(), onRoomMessageReceived: vi.fn(), clearMessageCallbacks: vi.fn(), joinChannel: vi.fn(), leaveChannel: vi.fn() } },
        { provide: ChatBroadcastService, useValue: { lastMessage: signal(null), isPopoutOpen: signal(false), openPopout: vi.fn(), focusPopout: vi.fn(), openConversationInPopout: vi.fn() } },
        { provide: AuthService, useValue: { user: signal({ id: 1 }) } },
        { provide: ActivatedRoute, useValue: { snapshot: { routeConfig: {}, queryParamMap: { get: () => null } } } },
      ],
    });
    fixture = TestBed.createComponent(ChatComponent);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  it('renders no button inside another button', () => {
    expect(el.querySelector('.channel-item__mute-btn')).not.toBeNull();
    expect(el.querySelector('.channel-section__action')).not.toBeNull();
    expect(el.querySelector('button button')).toBeNull();
  });

  it('mutes a channel without opening it', () => {
    (el.querySelector('.channel-item__mute-btn') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(chatService.muteChannel).toHaveBeenCalledWith(7, true);
    expect(el.querySelector('.channel-item__mute-btn')).not.toBeNull();
  });

  it('offers the paperclip in a channel', () => {
    (el.querySelector('.channel-item') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="chat-attach-btn"]')).not.toBeNull();
  });

  it('hides the paperclip in a direct message, where uploads are not supported', () => {
    fixture.componentInstance.selectConversation({
      userId: 2, userName: 'Ana', userInitials: 'A', userColor: '#000', lastMessage: null, lastMessageAt: null, unreadCount: 0,
    });
    fixture.detectChanges();

    expect(el.querySelector('[data-testid="chat-message-input"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="chat-attach-btn"]')).toBeNull();
  });
});
