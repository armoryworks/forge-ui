import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Observable, of } from 'rxjs';
import { provideTranslateService, TranslateLoader } from '@ngx-translate/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';

import { AiComponent } from './ai.component';
import { AiService, AiHelpMessage } from '../../shared/services/ai.service';

class FakeLoader implements TranslateLoader {
  getTranslation(): Observable<Record<string, string>> { return of({}); }
}

describe('AiComponent chat', () => {
  let fixture: ComponentFixture<AiComponent>;
  let assistantChat: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    assistantChat = vi.fn((_id: number, _q: string, _h?: AiHelpMessage[]) => of({ answer: 'Use fixture QF-FX-12.' }));

    TestBed.configureTestingModule({
      imports: [AiComponent],
      providers: [
        {
          provide: AiService,
          useValue: {
            getAssistants: () => of([{
              id: 7, name: 'General Assistant', description: 'Ask anything', icon: 'smart_toy',
              color: '#0d9488', category: 'General', starterQuestions: [], isActive: true,
            }]),
            assistantChat,
          },
        },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ assistantId: '7' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        provideTranslateService({ loader: { provide: TranslateLoader, useClass: FakeLoader } }),
      ],
    });

    fixture = TestBed.createComponent(AiComponent);
    fixture.detectChanges();
  });

  function send(text: string): void {
    const c = fixture.componentInstance as unknown as { messageInput: { setValue: (v: string) => void }; sendMessage: () => void };
    c.messageInput.setValue(text);
    c.sendMessage();
    fixture.detectChanges();
  }

  it('renders the question and the answer after sending', () => {
    send('Which fixture holds the bracket?');

    const el: HTMLElement = fixture.nativeElement;
    const messages = el.querySelectorAll('.chat-message');
    expect(messages.length).toBe(2);
    expect(messages[0].textContent).toContain('Which fixture holds the bracket?');
    expect(messages[1].textContent).toContain('Use fixture QF-FX-12.');
    expect(el.querySelector('.ai-chat__welcome')).toBeNull();
  });

  it('does not repeat the current question in the history it sends', () => {
    send('First question');
    send('Second question');

    const firstHistory = assistantChat.mock.calls[0][2] as AiHelpMessage[];
    const secondHistory = assistantChat.mock.calls[1][2] as AiHelpMessage[];
    expect(firstHistory).toEqual([]);
    expect(secondHistory.map(m => m.content)).toEqual(['First question', 'Use fixture QF-FX-12.']);
  });

  it('clear chat brings the welcome panel back', () => {
    send('Hello');
    (fixture.componentInstance as unknown as { clearChat: () => void }).clearChat();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('.chat-message').length).toBe(0);
    expect(el.querySelector('.ai-chat__welcome')).not.toBeNull();
  });
});
