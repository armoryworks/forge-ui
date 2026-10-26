import { describe, it, expect, beforeEach, vi } from 'vitest';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TranslateModule } from '@ngx-translate/core';

import { AuthService } from '../../../../shared/services/auth.service';
import { FileDownloadService } from '../../../../shared/services/file-download.service';
import { ChatMessage } from '../../models/chat-message.model';
import { ChatMessageAreaComponent } from './chat-message-area.component';

describe('ChatMessageAreaComponent composer', () => {
  let fixture: ComponentFixture<ChatMessageAreaComponent>;
  let input: HTMLInputElement;
  let fileDownload: { openOrDownload: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    fileDownload = { openOrDownload: vi.fn() };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ChatMessageAreaComponent, TranslateModule.forRoot()],
      providers: [
        provideNoopAnimations(),
        { provide: AuthService, useValue: { user: signal({ id: 1 }) } },
        { provide: FileDownloadService, useValue: fileDownload },
      ],
    });
    fixture = TestBed.createComponent(ChatMessageAreaComponent);
    fixture.detectChanges();
    input = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="chat-message-input"]') as HTMLInputElement;
  });

  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  it('keeps the draft after sending until the host confirms it was delivered', () => {
    const sent: string[] = [];
    fixture.componentInstance.messageSent.subscribe(v => sent.push(v));
    type('  hello  ');

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(sent).toEqual(['hello']);
    expect(input.value).toBe('  hello  ');

    fixture.componentInstance.clearComposer();
    fixture.detectChanges();

    expect(input.value).toBe('');
  });

  it('hides the paperclip when the host does not support attachments', () => {
    fixture.componentRef.setInput('showFileAttach', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.message-area__file-input')).toBeNull();
  });

  it('fetches an attachment with the login instead of following the bare link', () => {
    const message = {
      id: 7, senderId: 2, senderName: 'Pat', senderInitials: 'P', senderColor: '#000', content: '',
      createdAt: new Date(), parentMessageId: null, mentions: [],
      fileAttachment: { id: 42, fileName: 'drawing.pdf', contentType: 'application/pdf', size: 1024, url: '' },
    } as unknown as ChatMessage;
    fixture.componentRef.setInput('messages', [message]);
    fixture.detectChanges();

    const link = (fixture.nativeElement as HTMLElement).querySelector('.message-area__attachment-name') as HTMLAnchorElement;
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(fileDownload.openOrDownload).toHaveBeenCalledWith(
      expect.stringMatching(/\/files\/42\/download$/), 'drawing.pdf', 'application/pdf');
  });
});
