import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { ConfirmDialogData } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AuthService } from '../../../../shared/services/auth.service';
import { SnackbarService } from '../../../../shared/services/snackbar.service';
import { ChatRoom } from '../../../chat/models/chat-room.model';
import { ChatService } from '../../../chat/services/chat.service';
import { MobileChatChannelInfoComponent } from './mobile-chat-channel-info.component';

interface ChannelInfoInternals {
  channel: { set(ch: ChatRoom | null): void };
  getChannelTypeLabelKey(channel: ChatRoom): string;
  getRoleBadgeKey(role: string): string;
  toggleMute(): void;
  leaveChannel(): void;
}

describe('MobileChatChannelInfoComponent', () => {
  const open = vi.fn();
  const info = vi.fn();
  const chatService = {
    muteChannel: vi.fn(() => of(undefined)),
    leaveChannel: vi.fn(() => of(undefined)),
    getChannels: vi.fn(() => of([])),
  };
  let component: ChannelInfoInternals;

  const room = { id: 4, name: 'floor', channelType: 'TeamAuto', members: [] } as unknown as ChatRoom;

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: ChatService, useValue: chatService },
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
        { provide: SnackbarService, useValue: { info } },
        { provide: MatDialog, useValue: { open } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ channelId: '4' }) } } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new MobileChatChannelInfoComponent()) as unknown as ChannelInfoInternals;
    component.channel.set(room);
  });

  it('labels channel types with translation keys', () => {
    expect(component.getChannelTypeLabelKey(room)).toBe('mobileLegacyPages.channelInfo.typeTeam');
    expect(component.getChannelTypeLabelKey({ ...room, channelType: 'Other' } as unknown as ChatRoom))
      .toBe('mobileLegacyPages.channelInfo.typeChannel');
  });

  it('labels owner and admin roles and leaves members unbadged', () => {
    expect(component.getRoleBadgeKey('Owner')).toBe('mobileLegacyPages.channelInfo.roleOwner');
    expect(component.getRoleBadgeKey('Admin')).toBe('mobileLegacyPages.channelInfo.roleAdmin');
    expect(component.getRoleBadgeKey('Member')).toBe('');
  });

  it('confirms the mute with a translated message', () => {
    component.toggleMute();

    expect(chatService.muteChannel).toHaveBeenCalledWith(4, true);
    expect(info).toHaveBeenCalledWith('mobileLegacyPages.channelInfo.channelMuted');
  });

  it('asks before leaving with translated dialog text', () => {
    open.mockReturnValue({ afterClosed: () => of(true) });

    component.leaveChannel();

    const data = open.mock.calls[0][1].data as ConfirmDialogData;
    expect(data.title).toBe('mobileLegacyPages.channelInfo.leaveTitle');
    expect(data.message).toBe('mobileLegacyPages.channelInfo.leaveMessage');
    expect(data.confirmLabel).toBe('mobileLegacyPages.channelInfo.leaveConfirm');
    expect(info).toHaveBeenCalledWith('mobileLegacyPages.channelInfo.left');
  });
});
