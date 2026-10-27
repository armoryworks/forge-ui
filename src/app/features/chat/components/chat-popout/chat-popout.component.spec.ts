import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';

import { of } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { CapabilityService } from '../../../../shared/services/capability.service';
import { ChatHubService } from '../../../../shared/services/chat-hub.service';
import { ChatBroadcastService } from '../../services/chat-broadcast.service';
import { ChatService } from '../../services/chat.service';
import { ChatConversation } from '../../models/chat-conversation.model';
import { ChatPopoutComponent } from './chat-popout.component';

interface PopoutInternals {
  selectedConversation: { set(c: ChatConversation | null): void };
  canAttachFile(): boolean;
  pendingFileAttachmentId(): number | null;
  onFileSelected(file: File): void;
  onMessageSent(content: string): void;
}

const conversation = { userId: 8, userName: 'Rae, Test' } as unknown as ChatConversation;

describe('ChatPopoutComponent direct message files', () => {
  const chat = {
    uploadDirectMessageFile: vi.fn(),
    uploadChatFile: vi.fn(),
    sendMessage: vi.fn(),
  };

  function build(attachmentsOn: boolean): PopoutInternals {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: ChatService, useValue: chat },
        { provide: ChatHubService, useValue: {} },
        { provide: ChatBroadcastService, useValue: { lastMessage: signal(null) } },
        { provide: AuthService, useValue: { user: signal({ id: 1 }) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: CapabilityService, useValue: { isEnabled: (code: string) => attachmentsOn || code !== 'CAP-CROSS-ATTACHMENTS' } },
      ],
    });
    return TestBed.runInInjectionContext(() => new ChatPopoutComponent()) as unknown as PopoutInternals;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    chat.uploadDirectMessageFile.mockReturnValue(of({ id: 55, fileName: 'a.txt', contentType: 'text/plain', size: 3 }));
    chat.sendMessage.mockReturnValue(of({ id: 1 }));
  });

  it('offers the attach control in a direct message while attachments are on', () => {
    const popout = build(true);
    popout.selectedConversation.set(conversation);

    expect(popout.canAttachFile()).toBe(true);
  });

  it('hides it when attachments are off', () => {
    const popout = build(false);
    popout.selectedConversation.set(conversation);

    expect(popout.canAttachFile()).toBe(false);
  });

  it('uploads to the conversation and sends the file with the message', () => {
    const popout = build(true);
    popout.selectedConversation.set(conversation);
    const file = new File(['abc'], 'a.txt', { type: 'text/plain' });

    popout.onFileSelected(file);
    expect(chat.uploadDirectMessageFile).toHaveBeenCalledWith(8, file);
    expect(popout.pendingFileAttachmentId()).toBe(55);

    popout.onMessageSent('see attached');
    expect(chat.sendMessage).toHaveBeenCalledWith(8, 'see attached', 55);
  });
});
