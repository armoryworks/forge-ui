import { TestBed } from '@angular/core/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';

import { of } from 'rxjs';

import { AuthService } from '../../../../shared/services/auth.service';
import { LanguageService } from '../../../../shared/services/language.service';
import { ChatMessage } from '../../../chat/models/chat-message.model';
import { ChatService } from '../../../chat/services/chat.service';
import { MobileChatThreadComponent } from './mobile-chat-thread.component';

describe('MobileChatThreadComponent', () => {
  const message = (id: number): ChatMessage => ({
    id,
    senderId: 2,
    senderName: 'Sender',
    senderInitials: 'S',
    senderColor: '#000',
    recipientId: 1,
    content: 'hi',
    isRead: true,
    createdAt: new Date(2026, 9, 5, 14, 30),
    chatRoomId: 1,
    fileAttachment: null,
    linkedEntityType: null,
    linkedEntityId: null,
    parentMessageId: null,
    threadReplyCount: 0,
    threadLastReplyAt: null,
    mentions: [],
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [MobileChatThreadComponent],
      providers: [
        provideTranslateService(),
        { provide: ChatService, useValue: { getThread: vi.fn(() => of([message(2), message(3), message(4)])) } },
        { provide: AuthService, useValue: { user: () => ({ id: 1 }) } },
      ],
    });
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('es', {
      chat: { thread: { replyCount_one: '{{count}} respuesta', replyCount_other: '{{count}} respuestas' } },
    });
    translate.use('es');
    TestBed.inject(LanguageService).currentLanguage.set('es');
  });

  function render() {
    const fixture = TestBed.createComponent(MobileChatThreadComponent);
    fixture.componentRef.setInput('parentMessage', message(1));
    fixture.detectChanges();
    return fixture;
  }

  it('shows the reply count once in the header and the separator', () => {
    const el: HTMLElement = render().nativeElement;
    expect(el.querySelector('.chat-thread__header-count')?.textContent?.trim()).toBe('3 respuestas');
    expect(el.querySelector('.chat-thread__separator-label')?.textContent?.trim()).toBe('3 respuestas');
  });

  it('formats the parent timestamp with the app language', () => {
    const el: HTMLElement = render().nativeElement;
    const created = message(1).createdAt;
    const expected = `${created.toLocaleDateString('es', { weekday: 'short', month: 'short', day: 'numeric' })} ${created.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}`;
    expect(el.querySelector('.chat-thread__parent-time')?.textContent?.trim()).toBe(expected);
  });
});
