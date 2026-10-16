import { describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { ChatChannelListComponent } from './chat-channel-list.component';
import { ChatRoom } from '../../models/chat-room.model';

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
    const opened: ChatRoom[] = [];
    const muted: boolean[] = [];
    fixture.componentInstance.roomSelected.subscribe(r => opened.push(r));
    fixture.componentInstance.muteToggled.subscribe(e => muted.push(e.mute));

    (el.querySelector('.channel-list__mute-btn') as HTMLButtonElement).click();

    expect(muted).toEqual([true]);
    expect(opened).toEqual([]);
  });
});
